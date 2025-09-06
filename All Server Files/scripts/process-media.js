#!/usr/bin/env node

const { execSync, spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

/**
 * Media Processing Script for iPhone Audio Compatibility
 * 
 * This script ensures all video files have iPhone-compatible audio:
 * - Converts multi-channel audio to stereo
 * - Standardizes sample rate to 44.1kHz
 * - Uses AAC-LC codec with proper channel layout
 * - Maintains video quality while fixing audio
 */

const MEDIA_DIR = process.env.MEDIA_DIR || path.join(__dirname, '../server/media')
const BACKUP_DIR = path.join(MEDIA_DIR, '.originals')

// Simple glob implementation for video files
function findVideoFiles(dir) {
  const videoExtensions = ['.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4v']
  const files = []
  
  function scanDir(currentDir, relativePath = '') {
    const items = fs.readdirSync(currentDir)
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item)
      const relPath = path.join(relativePath, item)
      const stat = fs.statSync(fullPath)
      
      if (stat.isDirectory() && !item.startsWith('.')) {
        scanDir(fullPath, relPath)
      } else if (stat.isFile() && videoExtensions.includes(path.extname(item).toLowerCase())) {
        files.push(relPath)
      }
    }
  }
  
  scanDir(dir)
  return files
}

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
}

/**
 * Check if a video file has iPhone-incompatible audio
 */
async function checkAudioCompatibility(filePath) {
  try {
    const output = execSync(`ffprobe -v quiet -show_streams -select_streams a:0 "${filePath}" -of json`, { encoding: 'utf8' })
    const data = JSON.parse(output)
    
    if (!data.streams || data.streams.length === 0) {
      return { compatible: false, reason: 'No audio stream found' }
    }

    const audioStream = data.streams[0]
    const issues = []

    // Check channel count (iPhone Safari works best with 1-2 channels)
    if (audioStream.channels > 2) {
      issues.push(`Too many channels: ${audioStream.channels} (max: 2)`)
    }

    // Check for unknown channel layout
    if (audioStream.channel_layout === 'unknown' || !audioStream.channel_layout) {
      issues.push('Unknown or missing channel layout')
    }

    // Check sample rate (prefer 44.1kHz or 48kHz)
    const sampleRate = parseInt(audioStream.sample_rate)
    if (sampleRate !== 44100 && sampleRate !== 48000) {
      issues.push(`Unusual sample rate: ${sampleRate}Hz`)
    }

    // Check codec
    if (audioStream.codec_name !== 'aac') {
      issues.push(`Non-AAC codec: ${audioStream.codec_name}`)
    }

    return {
      compatible: issues.length === 0,
      reason: issues.join(', '),
      audioInfo: {
        codec: audioStream.codec_name,
        channels: audioStream.channels,
        channelLayout: audioStream.channel_layout,
        sampleRate: audioStream.sample_rate,
        bitRate: audioStream.bit_rate
      }
    }
  } catch (error) {
    return { compatible: false, reason: `Error checking file: ${error.message}` }
  }
}

/**
 * Convert video to iPhone-compatible format
 */
async function convertToCompatible(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    console.log(`Converting: ${path.basename(inputPath)}`)
    
    // FFmpeg command for iPhone-compatible conversion
    const ffmpegArgs = [
      '-i', inputPath,
      '-c:v', 'copy', // Keep video as-is (don't re-encode unnecessarily)
      '-c:a', 'aac',  // Use AAC audio codec
      '-ac', '2',     // Convert to stereo (2 channels)
      '-ar', '44100', // Set sample rate to 44.1kHz
      '-b:a', '128k', // Set audio bitrate to 128kbps (good quality for mobile)
      '-movflags', '+faststart', // Optimize for web streaming
      '-y', // Overwrite output file
      outputPath
    ]

    console.log(`Running: ffmpeg ${ffmpegArgs.join(' ')}`)
    
    const ffmpeg = spawn('ffmpeg', ffmpegArgs)
    
    let stderr = ''
    
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`✓ Conversion completed: ${path.basename(outputPath)}`)
        resolve()
      } else {
        console.error(`✗ Conversion failed: ${path.basename(inputPath)}`)
        console.error('FFmpeg error:', stderr)
        reject(new Error(`FFmpeg exited with code ${code}`))
      }
    })
    
    ffmpeg.on('error', (error) => {
      console.error(`✗ Failed to start FFmpeg: ${error.message}`)
      reject(error)
    })
  })
}

/**
 * Process all video files in the media directory
 */
async function processMediaFiles() {
  try {
    console.log('🎬 Starting media compatibility check...')
    console.log(`Media directory: ${path.resolve(MEDIA_DIR)}`)
    
    // Find all video files
    const files = findVideoFiles(MEDIA_DIR)
    
    console.log(`Found ${files.length} video files`)
    
    for (const relPath of files) {
      const fullPath = path.join(MEDIA_DIR, relPath)
      const parsedPath = path.parse(relPath)
      
      console.log(`\n📹 Checking: ${relPath}`)
      
      const compatibility = await checkAudioCompatibility(fullPath)
      
      if (compatibility.compatible) {
        console.log(`✓ Already compatible`)
        if (compatibility.audioInfo) {
          console.log(`  Audio: ${compatibility.audioInfo.codec}, ${compatibility.audioInfo.channels}ch, ${compatibility.audioInfo.sampleRate}Hz`)
        }
      } else {
        console.log(`⚠️  Needs conversion: ${compatibility.reason}`)
        if (compatibility.audioInfo) {
          console.log(`  Current: ${compatibility.audioInfo.codec}, ${compatibility.audioInfo.channels}ch, ${compatibility.audioInfo.sampleRate}Hz`)
        }
        
        // Create backup
        const backupPath = path.join(BACKUP_DIR, `${parsedPath.name}_original${parsedPath.ext}`)
        if (!fs.existsSync(backupPath)) {
          console.log(`📦 Creating backup: ${path.basename(backupPath)}`)
          fs.copyFileSync(fullPath, backupPath)
        }
        
        // Convert to compatible format
        const tempPath = path.join(MEDIA_DIR, `${parsedPath.name}_temp${parsedPath.ext}`)
        
        try {
          await convertToCompatible(fullPath, tempPath)
          
          // Replace original with converted version
          fs.renameSync(tempPath, fullPath)
          console.log(`✓ Successfully updated: ${relPath}`)
          
          // Verify the conversion worked
          const newCompatibility = await checkAudioCompatibility(fullPath)
          if (newCompatibility.compatible) {
            console.log(`✓ Verification passed`)
          } else {
            console.log(`⚠️  Verification failed: ${newCompatibility.reason}`)
          }
          
        } catch (error) {
          console.error(`✗ Failed to convert ${relPath}:`, error.message)
          // Clean up temp file if it exists
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath)
          }
        }
      }
    }
    
    console.log('\n🎉 Media processing completed!')
    
  } catch (error) {
    console.error('💥 Error during media processing:', error.message)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  processMediaFiles()
}

module.exports = { checkAudioCompatibility, convertToCompatible, processMediaFiles }
