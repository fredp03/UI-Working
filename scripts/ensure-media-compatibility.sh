#!/bin/bash

# VideoParty Media Compatibility Check
# Run this script to ensure all media files are iPhone-compatible

echo "🎬 VideoParty Media Compatibility Check"
echo "======================================="

# Check if FFmpeg is available
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ FFmpeg is not installed or not in PATH"
    echo "Please install FFmpeg to use media processing features"
    exit 1
fi

if ! command -v ffprobe &> /dev/null; then
    echo "❌ FFprobe is not installed or not in PATH"
    echo "Please install FFmpeg (includes ffprobe) to use media processing features"
    exit 1
fi

echo "✅ FFmpeg tools found"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VIDEOPARTY_ROOT="$(dirname "$SCRIPT_DIR")"

echo "📁 VideoParty root: $VIDEOPARTY_ROOT"

# Run the media processing script
echo "🔄 Running media compatibility check..."
cd "$SCRIPT_DIR"
node process-media.js

if [ $? -eq 0 ]; then
    echo "✅ Media compatibility check completed successfully"
    echo ""
    echo "💡 Tips:"
    echo "   • All video files are now iPhone/Safari compatible"
    echo "   • Original files are backed up in server/media/.originals/"
    echo "   • Run this script whenever you add new media files"
    echo ""
else
    echo "❌ Media compatibility check failed"
    echo "Please check the error messages above"
    exit 1
fi
