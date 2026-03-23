using System;
using System.IO;
using System.Windows.Media;

namespace VaporwaveCreator.Services
{
    public class MusicPlayerService : IDisposable
    {
        private MediaPlayer _player = new();
        private bool _isPlaying = false;
        private string? _currentFile;

        public bool IsPlaying => _isPlaying;

        public void Play(string filePath)
        {
            if (!File.Exists(filePath)) return;

            _currentFile = filePath;
            _player.Stop();
            _player.Close();
            _player = new MediaPlayer();
            _player.MediaEnded += (s, e) =>
            {
                _player.Position = TimeSpan.Zero;
                _player.Play();
            };
            _player.Open(new Uri(filePath));
            _player.Volume = 0.6;
            _player.Play();
            _isPlaying = true;
        }

        public void Stop()
        {
            _player.Stop();
            _isPlaying = false;
        }

        public void Toggle()
        {
            if (_isPlaying)
                Stop();
            else if (_currentFile != null)
                Play(_currentFile);
        }

        public void Dispose()
        {
            _player.Stop();
            _player.Close();
        }
    }
}