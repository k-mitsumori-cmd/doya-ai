/**
 * 文字起こし処理時間の計算スクリプト
 * ファイルサイズに応じた処理時間を計算し、3時間で処理可能な最大ファイルサイズを算出
 */

function calculateTranscriptionTime(fileSizeGB: number, isVideo: boolean) {
  const fileSizeMB = fileSizeGB * 1024
  
  let estimatedSeconds = 0
  
  if (isVideo) {
    // 動画ファイルの場合: 音声抽出時間 + 文字起こし時間
    // 音声抽出時間: 1MBあたり2秒（FFmpeg処理）
    const extractionTime = fileSizeMB * 2
    // 文字起こし時間: 音声長の40%（音声長 = fileSizeMB * 0.25分）
    const audioLengthMinutes = fileSizeMB * 0.25
    const transcriptionTime = audioLengthMinutes * 60 * 0.4
    estimatedSeconds = extractionTime + transcriptionTime
  } else {
    // 音声ファイルの場合: 文字起こし時間のみ
    // 音声長 = fileSizeMB * 0.8分
    const audioLengthMinutes = fileSizeMB * 0.8
    // 文字起こし時間: 音声長の35%
    const transcriptionTime = audioLengthMinutes * 60 * 0.35
    estimatedSeconds = transcriptionTime
  }
  
  // バッファ時間を追加（処理時間の50%、最低10分）
  const bufferTime = Math.max(10 * 60, estimatedSeconds * 0.5)
  const totalSeconds = estimatedSeconds + bufferTime
  
  return {
    fileSizeGB,
    fileSizeMB,
    extractionTime: isVideo ? fileSizeMB * 2 : 0,
    transcriptionTime: estimatedSeconds - (isVideo ? fileSizeMB * 2 : 0),
    estimatedSeconds,
    bufferTime,
    totalSeconds,
    totalMinutes: totalSeconds / 60,
    totalHours: totalSeconds / 3600,
  }
}

function findMaxFileSize(maxWaitHours: number, isVideo: boolean) {
  // 二分探索で最大ファイルサイズを求める
  let minGB = 0.1
  let maxGB = 100 // 最大100GBまで探索
  let bestGB = 0
  
  for (let i = 0; i < 50; i++) {
    const testGB = (minGB + maxGB) / 2
    const result = calculateTranscriptionTime(testGB, isVideo)
    
    if (result.totalHours <= maxWaitHours) {
      bestGB = testGB
      minGB = testGB
    } else {
      maxGB = testGB
    }
    
    if (Math.abs(maxGB - minGB) < 0.01) break
  }
  
  return bestGB
}

console.log('================================================================================')
console.log('文字起こし処理時間の計算')
console.log('================================================================================\n')

// 10GBファイルの処理時間を計算
console.log('【10GB動画ファイルの処理時間】')
const video10GB = calculateTranscriptionTime(10, true)
console.log(`ファイルサイズ: ${video10GB.fileSizeGB}GB (${video10GB.fileSizeMB.toLocaleString()}MB)`)
console.log(`音声抽出時間: ${(video10GB.extractionTime / 60).toFixed(1)}分 (${(video10GB.extractionTime / 3600).toFixed(2)}時間)`)
console.log(`文字起こし時間: ${(video10GB.transcriptionTime / 60).toFixed(1)}分 (${(video10GB.transcriptionTime / 3600).toFixed(2)}時間)`)
console.log(`バッファ時間: ${(video10GB.bufferTime / 60).toFixed(1)}分 (${(video10GB.bufferTime / 3600).toFixed(2)}時間)`)
console.log(`合計処理時間: ${video10GB.totalMinutes.toFixed(1)}分 (${video10GB.totalHours.toFixed(2)}時間)`)
console.log(`3時間で足りるか: ${video10GB.totalHours <= 3 ? '✓ 足りる' : '✗ 足りない'}`)
console.log(`3日（72時間）で足りるか: ${video10GB.totalHours <= 72 ? '✓ 足りる' : '✗ 足りない'}\n`)

console.log('【10GB音声ファイルの処理時間】')
const audio10GB = calculateTranscriptionTime(10, false)
console.log(`ファイルサイズ: ${audio10GB.fileSizeGB}GB (${audio10GB.fileSizeMB.toLocaleString()}MB)`)
console.log(`文字起こし時間: ${(audio10GB.transcriptionTime / 60).toFixed(1)}分 (${(audio10GB.transcriptionTime / 3600).toFixed(2)}時間)`)
console.log(`バッファ時間: ${(audio10GB.bufferTime / 60).toFixed(1)}分 (${(audio10GB.bufferTime / 3600).toFixed(2)}時間)`)
console.log(`合計処理時間: ${audio10GB.totalMinutes.toFixed(1)}分 (${audio10GB.totalHours.toFixed(2)}時間)`)
console.log(`3時間で足りるか: ${audio10GB.totalHours <= 3 ? '✓ 足りる' : '✗ 足りない'}`)
console.log(`3日（72時間）で足りるか: ${audio10GB.totalHours <= 72 ? '✓ 足りる' : '✗ 足りない'}\n`)

// 3時間で処理可能な最大ファイルサイズを計算
console.log('================================================================================')
console.log('3時間の待機時間で処理可能な最大ファイルサイズ')
console.log('================================================================================\n')

const maxVideo3h = findMaxFileSize(3, true)
const maxAudio3h = findMaxFileSize(3, false)

console.log(`動画ファイル: 約${maxVideo3h.toFixed(2)}GB`)
const videoMax = calculateTranscriptionTime(maxVideo3h, true)
console.log(`  処理時間: ${videoMax.totalHours.toFixed(2)}時間 (${videoMax.totalMinutes.toFixed(1)}分)\n`)

console.log(`音声ファイル: 約${maxAudio3h.toFixed(2)}GB`)
const audioMax = calculateTranscriptionTime(maxAudio3h, false)
console.log(`  処理時間: ${audioMax.totalHours.toFixed(2)}時間 (${audioMax.totalMinutes.toFixed(1)}分)\n`)

// 3日（72時間）で処理可能な最大ファイルサイズを計算
console.log('================================================================================')
console.log('3日（72時間）の待機時間で処理可能な最大ファイルサイズ')
console.log('================================================================================\n')

const maxVideo3d = findMaxFileSize(72, true)
const maxAudio3d = findMaxFileSize(72, false)

console.log(`動画ファイル: 約${maxVideo3d.toFixed(2)}GB`)
const videoMax3d = calculateTranscriptionTime(maxVideo3d, true)
console.log(`  処理時間: ${videoMax3d.totalHours.toFixed(2)}時間 (${videoMax3d.totalMinutes.toFixed(1)}分)\n`)

console.log(`音声ファイル: 約${maxAudio3d.toFixed(2)}GB`)
const audioMax3d = calculateTranscriptionTime(maxAudio3d, false)
console.log(`  処理時間: ${audioMax3d.totalHours.toFixed(2)}時間 (${audioMax3d.totalMinutes.toFixed(1)}分)\n`)

// 様々なファイルサイズの処理時間を表示
console.log('================================================================================')
console.log('様々なファイルサイズの処理時間')
console.log('================================================================================\n')

const sizes = [0.1, 0.5, 1, 2, 5, 10, 20, 50]
console.log('動画ファイル:')
console.log('サイズ(GB)\t処理時間(時間)\t3時間以内\t3日以内')
for (const size of sizes) {
  const result = calculateTranscriptionTime(size, true)
  const within3h = result.totalHours <= 3 ? '✓' : '✗'
  const within3d = result.totalHours <= 72 ? '✓' : '✗'
  console.log(`${size.toFixed(1)}\t\t${result.totalHours.toFixed(2)}\t\t${within3h}\t\t${within3d}`)
}

console.log('\n音声ファイル:')
console.log('サイズ(GB)\t処理時間(時間)\t3時間以内\t3日以内')
for (const size of sizes) {
  const result = calculateTranscriptionTime(size, false)
  const within3h = result.totalHours <= 3 ? '✓' : '✗'
  const within3d = result.totalHours <= 72 ? '✓' : '✗'
  console.log(`${size.toFixed(1)}\t\t${result.totalHours.toFixed(2)}\t\t${within3h}\t\t${within3d}`)
}

console.log('\n================================================================================')

