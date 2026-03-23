using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace VaporwaveCreator.Services
{
    public class AudioService
    {
        private static readonly string[] AllowedExtensions = { ".mp3", ".wav", ".flac" };
        private const long MaxFileSizeBytes = 30 * 1024 * 1024;

        private string EditFolder =>
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "WebModel", "dist", "audios", "edit");

        private string FfmpegPath =>
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Modules", "ffmpeg.exe");

        private string SessionMetadataPath =>
            Path.Combine(EditFolder, "session.json");

        private readonly BackupProjectService _backupProjectService = new();

        public async Task<(bool Success, string Filename, string Error)> ProcessAudioFileAsync(string name, string base64Data)
        {
            try
            {
                var ext = Path.GetExtension(name).ToLowerInvariant();
                if (!AllowedExtensions.Contains(ext))
                    return (false, "", $"Unsupported format: {ext}. Use mp3, wav, or flac.");

                var bytes = Convert.FromBase64String(base64Data);

                if (bytes.Length > MaxFileSizeBytes)
                    return (false, "", "File is too large. Maximum size: 30MB.");

                if (!Directory.Exists(EditFolder))
                    Directory.CreateDirectory(EditFolder);

                foreach (var f in Directory.GetFiles(EditFolder))
                    File.Delete(f);

                var filename = $"original_audio{ext}";
                var destPath = Path.Combine(EditFolder, filename);
                await File.WriteAllBytesAsync(destPath, bytes);

                var sessionJson = JsonSerializer.Serialize(new
                {
                    originalFilename = name,
                    uploadedAt = DateTime.Now.ToString("yyyy-MM-ddTHH:mm:ss")
                }, new JsonSerializerOptions
                {
                    WriteIndented = true
                });

                await File.WriteAllTextAsync(SessionMetadataPath, sessionJson);

                return (true, filename, "");
            }
            catch (Exception ex)
            {
                return (false, "", ex.Message);
            }
        }

        public Task<(bool Success, string UrlAudio, string Error)> GetAudioFileAsync(string name)
        {
            try
            {
                var files = Directory.GetFiles(EditFolder, $"{name}.*");
                if (files.Length == 0)
                    return Task.FromResult((false, "", $"File '{name}' was not found."));

                var file = files[0];
                var ext = Path.GetExtension(file);
                var url = $"/audios/edit/{name}{ext}";
                return Task.FromResult((true, url, ""));
            }
            catch (Exception ex)
            {
                return Task.FromResult((false, "", ex.Message));
            }
        }

        public async Task<(bool Success, string Error)> CutAsync(double start, double end)
        {
            try
            {
                var originals = Directory.GetFiles(EditFolder, "original_audio.*");
                if (originals.Length == 0)
                    return (false, "Original audio file was not found.");

                var inputPath = originals[0];
                var ext = Path.GetExtension(inputPath);
                var outputPath = Path.Combine(EditFolder, $"cut_audio{ext}");

                var duration = end - start;
                var args = $"-y -ss {start.ToString("F3", System.Globalization.CultureInfo.InvariantCulture)} " +
                           $"-i \"{inputPath}\" " +
                           $"-t {duration.ToString("F3", System.Globalization.CultureInfo.InvariantCulture)} " +
                           $"-c copy \"{outputPath}\"";

                var (ok, err) = await RunFfmpegAsync(args);
                return (ok, err);
            }
            catch (Exception ex)
            {
                return (false, ex.Message);
            }
        }

        public async Task<(bool Success, string UrlAudio, string Error)> ApplyVaporwaveAsync(
                            bool useRegion,
                            double start,
                            double end,
                            double speed,
                            double tempo,
                            double pitchSemitones,
                            bool reverbEnabled,
                            int reverbDelayMs,
                            double reverbDecay)
        {
            try
            {
                var originals = Directory.GetFiles(EditFolder, "original_audio.*");
                if (originals.Length == 0)
                    return (false, "", "Original audio file not found.");

                var inputPath = originals[0];
                var outputPath = Path.Combine(EditFolder, "vaporwave_preview.mp3");

                if (!Directory.Exists(EditFolder))
                    Directory.CreateDirectory(EditFolder);

                if (File.Exists(outputPath))
                    File.Delete(outputPath);

                speed = Clamp(speed, 0.50, 1.20);
                tempo = Clamp(tempo, 0.50, 1.50);
                pitchSemitones = Clamp(pitchSemitones, -12.0, 12.0);
                reverbDelayMs = (int)Clamp(reverbDelayMs, 20, 200);
                reverbDecay = Clamp(reverbDecay, 0.10, 0.80);

                var filter = BuildVaporwaveFilter(
                    speed,
                    tempo,
                    pitchSemitones,
                    reverbEnabled,
                    reverbDelayMs,
                    reverbDecay);

                var args = new StringBuilder("-y ");

                if (useRegion && end > start)
                {
                    args.Append($"-ss {Invariant(start)} ");
                }

                args.Append($"-i \"{inputPath}\" ");

                if (useRegion && end > start)
                {
                    args.Append($"-t {Invariant(end - start)} ");
                }

                args.Append($"-vn -af \"{filter}\" -c:a libmp3lame -b:a 320k \"{outputPath}\"");

                var (ok, err) = await RunFfmpegAsync(args.ToString());

                if (!ok)
                    return (false, "", err);

                var originalFilename = await GetStoredOriginalFilenameAsync(inputPath);

                var settingsPayload = new
                {
                    useRegion,
                    start,
                    end,
                    speed,
                    tempo,
                    pitchSemitones,
                    reverbEnabled,
                    reverbDelayMs,
                    reverbDecay
                };

                string backupWarning = "";

                try
                {
                    await _backupProjectService.SaveProjectBackupAsync(
                        outputPath,
                        originalFilename,
                        settingsPayload);
                }
                catch (Exception ex)
                {
                    backupWarning = $" Backup warning: {ex.Message}";
                }

                return (true, "/audios/edit/vaporwave_preview.mp3", backupWarning);
            }
            catch (Exception ex)
            {
                return (false, "", ex.Message);
            }
        }

        private string BuildVaporwaveFilter(
            double speed,
            double tempo,
            double pitchSemitones,
            bool reverbEnabled,
            int reverbDelayMs,
            double reverbDecay)
        {
            var filters = new List<string>();

            if (Math.Abs(speed - 1.0) > 0.0001)
            {
                filters.Add($"asetrate=44100*{Invariant(speed)}");
                filters.Add("aresample=44100");
            }

            if (Math.Abs(pitchSemitones) > 0.0001)
            {
                var pitchRatio = Math.Pow(2.0, pitchSemitones / 12.0);

                filters.Add($"asetrate=44100*{Invariant(pitchRatio)}");
                filters.Add("aresample=44100");

                filters.Add(BuildAtempoChain(1.0 / pitchRatio));
            }

            if (Math.Abs(tempo - 1.0) > 0.0001)
            {
                filters.Add(BuildAtempoChain(tempo));
            }

            if (reverbEnabled)
            {
                filters.Add($"aecho=0.8:0.7:{reverbDelayMs}:{Invariant(reverbDecay)}");
            }

            filters.Add("volume=1.10");

            return string.Join(",", filters.Where(x => !string.IsNullOrWhiteSpace(x)));
        }

        private string BuildAtempoChain(double value)
        {
            value = Clamp(value, 0.25, 4.0);

            var parts = new List<string>();

            while (value < 0.5)
            {
                parts.Add("atempo=0.5");
                value /= 0.5;
            }

            while (value > 2.0)
            {
                parts.Add("atempo=2.0");
                value /= 2.0;
            }

            parts.Add($"atempo={Invariant(value)}");

            return string.Join(",", parts);
        }

        private static string Invariant(double value)
        {
            return value.ToString("0.####", CultureInfo.InvariantCulture);
        }

        private static double Clamp(double value, double min, double max)
        {
            if (value < min) return min;
            if (value > max) return max;
            return value;
        }

        private async Task<string> GetStoredOriginalFilenameAsync(string inputPath)
        {
            try
            {
                if (File.Exists(SessionMetadataPath))
                {
                    var json = await File.ReadAllTextAsync(SessionMetadataPath);
                    using var doc = JsonDocument.Parse(json);

                    if (doc.RootElement.TryGetProperty("originalFilename", out var originalFilenameEl))
                    {
                        var originalFilename = originalFilenameEl.GetString();
                        if (!string.IsNullOrWhiteSpace(originalFilename))
                            return originalFilename;
                    }
                }
            }
            catch
            {
                // Fallback below
            }

            var ext = Path.GetExtension(inputPath);
            return $"audio{ext}";
        }

        private async Task<(bool Success, string Error)> RunFfmpegAsync(string args)
        {
            try
            {
                if (!File.Exists(FfmpegPath))
                {
                    return (false, $"FFmpeg was not found at: {FfmpegPath}");
                }

                var psi = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = FfmpegPath,
                    Arguments = args,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardError = true,
                    RedirectStandardOutput = true
                };

                using var process = System.Diagnostics.Process.Start(psi)
                    ?? throw new Exception("Could not start FFmpeg.");

                var stderrTask = process.StandardError.ReadToEndAsync();
                var stdoutTask = process.StandardOutput.ReadToEndAsync();

                await process.WaitForExitAsync();

                var stderr = await stderrTask;
                var stdout = await stdoutTask;

                if (process.ExitCode == 0)
                    return (true, "");

                var ffmpegOutput = string.IsNullOrWhiteSpace(stderr) ? stdout : stderr;
                return (false, $"FFmpeg error: {ffmpegOutput}");
            }
            catch (Exception ex)
            {
                return (false, ex.Message);
            }
        }
    }
}