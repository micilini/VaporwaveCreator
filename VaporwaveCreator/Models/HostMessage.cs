using System.Text.Json;
using System.Text.Json.Serialization;

namespace VaporwaveCreator.Models
{
    public class HostMessage
    {
        [JsonPropertyName("tag")]
        public string Tag { get; set; } = "";

        [JsonPropertyName("payload")]
        public JsonElement Payload { get; set; }
    }
}