using System;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace VaporwaveCreator.Services
{
    public class BackupProjectService
    {
        private const string AppFolderName = "Vaporwave Creator";

        public string GetProjectsRootFolder()
        {
            var documents = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
            var root = Path.Combine(documents, AppFolderName);

            if (!Directory.Exists(root))
                Directory.CreateDirectory(root);

            return root;
        }

        public string GetSessionFolder()
        {
            var root = GetProjectsRootFolder();
            var folderName = DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss-fff");
            var sessionFolder = Path.Combine(root, folderName);

            if (!Directory.Exists(sessionFolder))
            {
                Directory.CreateDirectory(sessionFolder);
                return sessionFolder;
            }

            var uniqueFolderName = $"{folderName}_{Guid.NewGuid().ToString("N")[..6]}";
            sessionFolder = Path.Combine(root, uniqueFolderName);

            Directory.CreateDirectory(sessionFolder);
            return sessionFolder;
        }

        public async Task<string> SaveProjectBackupAsync(
            string generatedAudioPath,
            string originalFilename,
            object settingsPayload)
        {
            if (!File.Exists(generatedAudioPath))
                throw new FileNotFoundException("Generated audio file was not found.", generatedAudioPath);

            var sessionFolder = GetSessionFolder();
            var safeBaseName = SanitizeFileName(Path.GetFileNameWithoutExtension(originalFilename));
            var sourceExtension = Path.GetExtension(generatedAudioPath);

            if (string.IsNullOrWhiteSpace(safeBaseName))
                safeBaseName = "vaporwave-track";

            if (string.IsNullOrWhiteSpace(sourceExtension))
                sourceExtension = ".mp3";

            var finalAudioPath = Path.Combine(sessionFolder, $"{safeBaseName}-vaporwave{sourceExtension}");
            File.Copy(generatedAudioPath, finalAudioPath, overwrite: true);

            var metadataPath = Path.Combine(sessionFolder, "project.json");
            var metadata = new
            {
                app = "Vaporwave Creator",
                version = "1.0.0",
                createdAt = DateTime.Now.ToString("yyyy-MM-ddTHH:mm:ss"),
                originalFilename,
                generatedFilename = Path.GetFileName(finalAudioPath),
                settings = settingsPayload
            };

            var json = JsonSerializer.Serialize(metadata, new JsonSerializerOptions
            {
                WriteIndented = true
            });

            await File.WriteAllTextAsync(metadataPath, json);

            return sessionFolder;
        }

        public void OpenProjectsFolder()
        {
            var root = GetProjectsRootFolder();

            Process.Start(new ProcessStartInfo
            {
                FileName = root,
                UseShellExecute = true
            });
        }

        private static string SanitizeFileName(string value)
        {
            var invalid = $"[{Regex.Escape(new string(Path.GetInvalidFileNameChars()))}]";
            var sanitized = Regex.Replace(value, invalid, "_").Trim();

            if (string.IsNullOrWhiteSpace(sanitized))
                return "vaporwave-track";

            return sanitized;
        }
    }
}