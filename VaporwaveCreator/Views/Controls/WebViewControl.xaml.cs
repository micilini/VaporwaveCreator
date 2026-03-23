using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;
using System;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using VaporwaveCreator.Models;
using VaporwaveCreator.Services;
using Path = System.IO.Path;

namespace VaporwaveCreator.Views.Controls
{
    public partial class WebViewControl : UserControl
    {
        private readonly AudioService _audioService = new();
        private readonly MusicPlayerService _musicPlayer = new();
        private readonly BackupProjectService _backupProjectService = new();

        private const string VirtualHostName = "app.vaporwavecreator";
        private readonly string _webRootFolder;
        private readonly string _initMusicPath;

        public WebViewControl()
        {
            InitializeComponent();
            var exeFolder = AppDomain.CurrentDomain.BaseDirectory;
            _webRootFolder = Path.Combine(exeFolder, "WebModel", "dist");
            _initMusicPath = Path.Combine(exeFolder, "Resources", "init.mp3");
            Loaded += WebViewControl_Loaded;
        }

        private async void WebViewControl_Loaded(object sender, RoutedEventArgs e)
        {
            ShowLoader(true);

            if (!Directory.Exists(_webRootFolder))
            {
                await webView.EnsureCoreWebView2Async();
                webView.CoreWebView2.NavigateToString(@"
                    <html><body style='background:#1A0A2E;color:#FF6B9D;
                    font-family:monospace;display:flex;flex-direction:column;align-items:center;
                    justify-content:center;height:100vh;margin:0;font-size:18px;gap:12px;'>
                    <span>ＶＡＰＯＲＷＡＶＥ ＣＲＥＡＴＯＲ</span>
                    <small style='color:#C471ED;font-size:13px'>React build not found — run: npm run build</small>
                    </body></html>");
                ShowLoader(false);
                return;
            }

            await webView.EnsureCoreWebView2Async();
            webView.CoreWebView2.DownloadStarting += CoreWebView2_DownloadStarting;
            webView.CoreWebView2.NewWindowRequested += CoreWebView2_NewWindowRequested;
            webView.CoreWebView2.NavigationCompleted += CoreWebView2_NavigationCompleted;

            webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                VirtualHostName,
                _webRootFolder,
                CoreWebView2HostResourceAccessKind.Allow);

            var settings = webView.CoreWebView2.Settings;
            settings.AreDefaultContextMenusEnabled = false;
            settings.IsZoomControlEnabled = false;
            settings.AreDevToolsEnabled = false;
            settings.IsWebMessageEnabled = true;

            webView.CoreWebView2.NavigationStarting += CoreWebView2_NavigationStarting;
            webView.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;
            webView.PreviewKeyDown += WebView_PreviewKeyDown;

            webView.CoreWebView2.Navigate($"https://{VirtualHostName}/index.html");
        }

        private void ShowLoader(bool visible)
        {
            Dispatcher.Invoke(() =>
            {
                loaderOverlay.Visibility = visible ? Visibility.Visible : Visibility.Collapsed;
                webView.Visibility = visible ? Visibility.Hidden : Visibility.Visible;
            });
        }

        private void CoreWebView2_NavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            ShowLoader(false);

            if (File.Exists(_initMusicPath))
                Dispatcher.Invoke(() => _musicPlayer.Play(_initMusicPath));

            SendMessageToWeb("musicStatusChanged", new { isPlaying = _musicPlayer.IsPlaying });
        }


        private void CoreWebView2_NewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs args)
        {
            args.Handled = true;
            Process.Start(new ProcessStartInfo(args.Uri) { UseShellExecute = true });
        }

        private void CoreWebView2_NavigationStarting(object sender, CoreWebView2NavigationStartingEventArgs args)
        {
            if (!Uri.TryCreate(args.Uri, UriKind.Absolute, out var uri)) { args.Cancel = true; return; }
            if (uri.Host.Equals(VirtualHostName, StringComparison.OrdinalIgnoreCase)) return;
            args.Cancel = true;
            Process.Start(new ProcessStartInfo(args.Uri) { UseShellExecute = true });
        }

        private void WebView_PreviewKeyDown(object sender, System.Windows.Input.KeyEventArgs e)
        {
            bool ctrl = (System.Windows.Input.Keyboard.Modifiers & System.Windows.Input.ModifierKeys.Control) == System.Windows.Input.ModifierKeys.Control;
            bool shift = (System.Windows.Input.Keyboard.Modifiers & System.Windows.Input.ModifierKeys.Shift) == System.Windows.Input.ModifierKeys.Shift;

            bool block =
                e.Key == System.Windows.Input.Key.F12 ||
                (ctrl && shift && e.Key == System.Windows.Input.Key.I) ||
                (ctrl && shift && e.Key == System.Windows.Input.Key.J) ||
                (ctrl && shift && e.Key == System.Windows.Input.Key.C) ||
                (ctrl && e.Key == System.Windows.Input.Key.U);

            if (block)
            {
                e.Handled = true;
            }
        }

        private async void CoreWebView2_WebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs args)
        {
            try
            {
                var msg = JsonSerializer.Deserialize<HostMessage>(args.WebMessageAsJson);
                if (msg == null) return;

                switch (msg.Tag)
                {
                    case "ping":
                        SendMessageToWeb("pong", new { message = "ＶＡＰＯＲＷＡＶＥ ＣＲＥＡＴＯＲ online" });
                        break;

                    case "toggleMusic":
                        Dispatcher.Invoke(() =>
                        {
                            if (_musicPlayer.IsPlaying)
                                _musicPlayer.Stop();
                            else if (File.Exists(_initMusicPath))
                                _musicPlayer.Play(_initMusicPath);
                        });
                        SendMessageToWeb("musicStatusChanged", new { isPlaying = _musicPlayer.IsPlaying });
                        break;

                    case "stopMusic":
                        Dispatcher.Invoke(() => _musicPlayer.Stop());
                        SendMessageToWeb("musicStatusChanged", new { isPlaying = _musicPlayer.IsPlaying });
                        break;

                    case "playMusic":
                        Dispatcher.Invoke(() =>
                        {
                            if (!_musicPlayer.IsPlaying && File.Exists(_initMusicPath))
                                _musicPlayer.Play(_initMusicPath);
                        });
                        SendMessageToWeb("musicStatusChanged", new { isPlaying = _musicPlayer.IsPlaying });
                        break;

                    case "getMusicStatus":
                        SendMessageToWeb("musicStatusChanged", new { isPlaying = _musicPlayer.IsPlaying });
                        break;

                    case "processAudioFile":
                        {
                            var name = msg.Payload.GetProperty("name").GetString() ?? "";
                            var data = msg.Payload.GetProperty("data").GetString() ?? "";
                            var (success, filename, error) = await _audioService.ProcessAudioFileAsync(name, data);
                            SendMessageToWeb("processAudioFileResponse", new { success, filename, error });
                            break;
                        }

                    case "getAudioFile":
                        {
                            var name = msg.Payload.GetProperty("name").GetString() ?? "";
                            var (success, urlAudio, error) = await _audioService.GetAudioFileAsync(name);
                            SendMessageToWeb("getAudioFileResponse", new { success, urlAudio, error });
                            break;
                        }

                    case "cutAudio":
                        {
                            double start = msg.Payload.GetProperty("start").GetDouble();
                            double end = msg.Payload.GetProperty("end").GetDouble();
                            var (ok, error) = await _audioService.CutAsync(start, end);
                            SendMessageToWeb("cutAudioResponse", new { success = ok, error });
                            break;
                        }

                    case "applyVaporwave":
                        {
                            bool useRegion = msg.Payload.TryGetProperty("useRegion", out var useRegionEl) && useRegionEl.GetBoolean();
                            double start = msg.Payload.TryGetProperty("start", out var startEl) ? startEl.GetDouble() : 0;
                            double end = msg.Payload.TryGetProperty("end", out var endEl) ? endEl.GetDouble() : 0;

                            double speed = msg.Payload.TryGetProperty("speed", out var speedEl) ? speedEl.GetDouble() : 0.68;
                            double tempo = msg.Payload.TryGetProperty("tempo", out var tempoEl) ? tempoEl.GetDouble() : 1.0;
                            double pitchSemitones = msg.Payload.TryGetProperty("pitchSemitones", out var pitchEl) ? pitchEl.GetDouble() : 0.0;

                            bool reverbEnabled = msg.Payload.TryGetProperty("reverbEnabled", out var reverbEnabledEl) && reverbEnabledEl.GetBoolean();
                            int reverbDelayMs = msg.Payload.TryGetProperty("reverbDelayMs", out var reverbDelayEl) ? reverbDelayEl.GetInt32() : 60;
                            double reverbDecay = msg.Payload.TryGetProperty("reverbDecay", out var reverbDecayEl) ? reverbDecayEl.GetDouble() : 0.3;

                            var (ok, urlAudio, error) = await _audioService.ApplyVaporwaveAsync(
                                useRegion,
                                start,
                                end,
                                speed,
                                tempo,
                                pitchSemitones,
                                reverbEnabled,
                                reverbDelayMs,
                                reverbDecay);

                            SendMessageToWeb("applyVaporwaveResponse", new
                            {
                                success = ok,
                                urlAudio,
                                error,
                                warning = ok && !string.IsNullOrWhiteSpace(error) ? error : ""
                            });
                            break;
                        }

                    case "openProjectsFolder":
                        {
                            _backupProjectService.OpenProjectsFolder();
                            SendMessageToWeb("openProjectsFolderResponse", new { success = true });
                            break;
                        }

                    case "getProjectsFolder":
                        {
                            var folder = _backupProjectService.GetProjectsRootFolder();
                            SendMessageToWeb("getProjectsFolderResponse", new { success = true, folder });
                            break;
                        }

                    case "downloadAudio":
                        {
                            var audioUrl = msg.Payload.GetProperty("url").GetString() ?? "";
                            var suggestedName = msg.Payload.GetProperty("filename").GetString() ?? "audio";

                            if (string.IsNullOrWhiteSpace(audioUrl))
                            { SendMessageToWeb("downloadAudioResponse", new { success = false, error = "Empty URL." }); break; }

                            string physicalPath;
                            var exeDir = AppDomain.CurrentDomain.BaseDirectory;
                            if (Uri.TryCreate(audioUrl, UriKind.Absolute, out var uri))
                            {
                                var rel = uri.AbsolutePath.TrimStart('/');
                                physicalPath = Path.Combine(exeDir, "WebModel", "dist", rel.Replace('/', Path.DirectorySeparatorChar));
                            }
                            else
                            {
                                physicalPath = Path.Combine(exeDir, "WebModel", "dist", audioUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
                            }

                            if (!File.Exists(physicalPath))
                            { SendMessageToWeb("downloadAudioResponse", new { success = false, error = "File not found on disk." }); break; }

                            string? targetPath = null;
                            Dispatcher.Invoke(() =>
                            {
                                var dlg = new SaveFileDialog
                                {
                                    FileName = suggestedName,
                                    Filter = "Audio files|*.mp3;*.wav;*.flac|All files|*.*",
                                    Title = "Save audio"
                                };
                                if (dlg.ShowDialog() == true) targetPath = dlg.FileName;
                            });

                            if (string.IsNullOrWhiteSpace(targetPath))
                            { SendMessageToWeb("downloadAudioResponse", new { success = false, error = "Cancelled." }); break; }

                            File.Copy(physicalPath, targetPath, overwrite: true);
                            SendMessageToWeb("downloadAudioResponse", new { success = true });
                            break;
                        }

                    default:
                        Console.WriteLine($"[VaporwaveCreator] Unknown tag: {msg.Tag}");
                        break;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[VaporwaveCreator] Error: {ex}");
            }
        }

        private void CoreWebView2_DownloadStarting(object? sender, CoreWebView2DownloadStartingEventArgs args)
            => args.Cancel = true;

        public void SendMessageToWeb(string tag, object payload)
        {
            var wrapper = new { tag, payload };
            webView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(wrapper));
        }
    }
}