import AVFoundation
import AppKit
import CoreMedia
import Foundation
import ScreenCaptureKit

final class VideoWriter: NSObject, SCStreamOutput {
    private let writer: AVAssetWriter
    private let input: AVAssetWriterInput
    private var started = false
    private let completion: CheckedContinuation<Void, Never>?

    init(outputURL: URL, width: Int, height: Int) throws {
        writer = try AVAssetWriter(outputURL: outputURL, fileType: .mov)
        input = AVAssetWriterInput(
            mediaType: .video,
            outputSettings: [
                AVVideoCodecKey: AVVideoCodecType.h264,
                AVVideoWidthKey: width,
                AVVideoHeightKey: height,
                AVVideoCompressionPropertiesKey: [
                    AVVideoAverageBitRateKey: 12_000_000,
                    AVVideoExpectedSourceFrameRateKey: 30,
                    AVVideoMaxKeyFrameIntervalKey: 60,
                    AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
                ]
            ]
        )
        input.expectsMediaDataInRealTime = true
        guard writer.canAdd(input) else {
            throw NSError(domain: "ContinuousScreenRecorder", code: 1, userInfo: [NSLocalizedDescriptionKey: "AVAssetWriter cannot add the video input"])
        }
        writer.add(input)
        completion = nil
        super.init()
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen, sampleBuffer.isValid else { return }
        guard let attachments = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]],
              let statusRaw = attachments.first?[.status] as? Int,
              SCFrameStatus(rawValue: statusRaw) == .complete else { return }

        if !started {
            started = true
            guard writer.startWriting() else { return }
            writer.startSession(atSourceTime: sampleBuffer.presentationTimeStamp)
        }
        if input.isReadyForMoreMediaData {
            input.append(sampleBuffer)
        }
    }

    func finish() async throws {
        input.markAsFinished()
        await writer.finishWriting()
        if writer.status != .completed {
            throw writer.error ?? NSError(domain: "ContinuousScreenRecorder", code: 2, userInfo: [NSLocalizedDescriptionKey: "AVAssetWriter did not complete"])
        }
    }
}

@main
struct ContinuousScreenRecorder {
    static func main() async throws {
        let arguments = CommandLine.arguments
        guard arguments.count >= 3, let seconds = Double(arguments[2]), seconds > 0 else {
            FileHandle.standardError.write(Data("usage: ContinuousScreenRecorder output.mov seconds [displayIndex] [windowOwner] [windowTitleContains]\n".utf8))
            Foundation.exit(2)
        }

        let outputURL = URL(fileURLWithPath: arguments[1])
        let displayIndex = arguments.count >= 4 ? (Int(arguments[3]) ?? 0) : 0
        let windowOwner = arguments.count >= 5 ? arguments[4] : nil
        let windowTitleContains = arguments.count >= 6 ? arguments[5] : nil
        try? FileManager.default.removeItem(at: outputURL)
        try FileManager.default.createDirectory(at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true)

        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        let filter: SCContentFilter
        let width: Int
        let height: Int
        if let owner = windowOwner, let titlePart = windowTitleContains {
            guard let window = content.windows.first(where: {
                $0.owningApplication?.applicationName == owner && $0.title?.localizedCaseInsensitiveContains(titlePart) == true
            }) else {
                let available = content.windows.compactMap { window -> String? in
                    guard let appName = window.owningApplication?.applicationName else { return nil }
                    return "\(appName):\(window.title ?? "")"
                }.joined(separator: " | ")
                throw NSError(domain: "ContinuousScreenRecorder", code: 4, userInfo: [NSLocalizedDescriptionKey: "window not found for \(owner) title containing \(titlePart). available: \(available)"])
            }
            let scale = NSScreen.main?.backingScaleFactor ?? 2.0
            width = max(2, Int(window.frame.width * scale) / 2 * 2)
            height = max(2, Int(window.frame.height * scale) / 2 * 2)
            filter = SCContentFilter(desktopIndependentWindow: window)
        } else {
            guard content.displays.indices.contains(displayIndex) else {
                throw NSError(domain: "ContinuousScreenRecorder", code: 3, userInfo: [NSLocalizedDescriptionKey: "display index \(displayIndex) is unavailable"])
            }
            let display = content.displays[displayIndex]
            let scale = NSScreen.screens.first(where: { Int($0.frame.width) == display.width || Int($0.frame.height) == display.height })?.backingScaleFactor ?? 2.0
            width = Int(Double(display.width) * scale)
            height = Int(Double(display.height) * scale)
            filter = SCContentFilter(display: display, excludingWindows: [])
        }
        let configuration = SCStreamConfiguration()
        configuration.width = width
        configuration.height = height
        configuration.minimumFrameInterval = CMTime(value: 1, timescale: 30)
        configuration.queueDepth = 8
        configuration.pixelFormat = kCVPixelFormatType_32BGRA
        configuration.showsCursor = true
        configuration.capturesAudio = false

        let videoWriter = try VideoWriter(outputURL: outputURL, width: width, height: height)
        let stream = SCStream(filter: filter, configuration: configuration, delegate: nil)
        try stream.addStreamOutput(videoWriter, type: .screen, sampleHandlerQueue: DispatchQueue(label: "doyamarke.capture.video", qos: .userInteractive))
        try await stream.startCapture()
        try await Task.sleep(for: .seconds(seconds))
        try await stream.stopCapture()
        try await videoWriter.finish()
        print("RECORDED \(String(format: "%.2f", seconds))s \(width)x\(height) \(outputURL.path)")
    }
}
