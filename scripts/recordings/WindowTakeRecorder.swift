import AVFoundation
import AppKit
import CoreMedia
import Foundation
import ScreenCaptureKit

final class WindowWriter: NSObject, SCStreamOutput {
    let writer: AVAssetWriter
    let input: AVAssetWriterInput
    var frames = 0
    var dropped = 0
    var timestamps: [Double] = []
    init(url: URL, width: Int, height: Int) throws {
        writer = try AVAssetWriter(outputURL: url, fileType: .mov)
        input = AVAssetWriterInput(mediaType: .video, outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: width, AVVideoHeightKey: height,
            AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 16_000_000,
                AVVideoExpectedSourceFrameRateKey: 60, AVVideoMaxKeyFrameIntervalKey: 120]])
        input.expectsMediaDataInRealTime = true
        guard writer.canAdd(input) else { throw NSError(domain: "WindowTake", code: 1) }
        writer.add(input)
    }
    func stream(_ stream: SCStream, didOutputSampleBuffer sample: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen, sample.isValid,
            let a = CMSampleBufferGetSampleAttachmentsArray(sample, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]],
            let raw = a.first?[.status] as? Int, SCFrameStatus(rawValue: raw) == .complete else { return }
        if writer.status == .unknown {
            guard writer.startWriting() else { return }
            writer.startSession(atSourceTime: sample.presentationTimeStamp)
        }
        guard input.isReadyForMoreMediaData else { dropped += 1; return }
        if input.append(sample) { frames += 1; timestamps.append(sample.presentationTimeStamp.seconds) }
        else { dropped += 1 }
    }
    func finish(url: URL) async throws {
        guard frames > 0 else { throw NSError(domain: "WindowTakeNoFrames", code: 2) }
        input.markAsFinished()
        await writer.finishWriting()
        guard writer.status == .completed else { throw writer.error ?? NSError(domain: "WindowTake", code: 3) }
        let base = timestamps[0]
        let stats: [String: Any] = ["frames": frames, "dropped": dropped,
            "source": "ScreenCaptureKit isolated window", "requestedFPS": 60,
            "frameTimes": timestamps.map { $0 - base },
            "duration": timestamps.last! - base]
        let data = try JSONSerialization.data(withJSONObject: stats, options: [.prettyPrinted, .sortedKeys])
        try data.write(to: URL(fileURLWithPath: url.path + ".timing.json"))
    }
}

@main struct WindowTakeRecorder {
    static func main() async {
        _ = NSApplication.shared
        NSApp.setActivationPolicy(.prohibited)
        do { try await record() }
        catch { FileHandle.standardError.write(Data("RECORDING_FAILED: \(error.localizedDescription)\n".utf8)); exit(1) }
    }
    static func record() async throws {
        let args = CommandLine.arguments
        if args.count == 2 && args[1] == "--list-chrome" {
            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
            print("windows=\(content.windows.count) displays=\(content.displays.count)")
            for w in content.windows where w.owningApplication?.applicationName.localizedCaseInsensitiveContains("chrome") == true {
                print("\(w.windowID) | \(w.owningApplication?.bundleIdentifier ?? "") | \(w.title ?? "") | \(w.frame)")
            }
            return
        }
        guard args.count >= 4, let seconds = Double(args[2]), seconds > 0, seconds <= 240 else {
            throw NSError(domain: "Usage: WindowTakeRecorder output.mov seconds exactWindowTitle", code: 4)
        }
        let url = URL(fileURLWithPath: args[1])
        guard !FileManager.default.fileExists(atPath: url.path) else {
            throw NSError(domain: "Refusing to overwrite existing take", code: 5)
        }
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
        let matches = content.windows.filter { $0.owningApplication?.bundleIdentifier == "com.google.Chrome" && ($0.title == args[3] || $0.title == args[3] + " - Google Chrome") }
        guard matches.count == 1, let window = matches.first else {
            throw NSError(domain: "Expected exactly one recording window; found \(matches.count). No desktop fallback.", code: 6)
        }
        let filter = SCContentFilter(desktopIndependentWindow: window)
        let config = SCStreamConfiguration()
        config.width = Int(window.frame.width * 2) / 2 * 2
        config.height = Int(window.frame.height * 2) / 2 * 2
        if let sizeArg = args.dropFirst(4).first(where: { $0.hasPrefix("--capture-size=") }) {
            let size = sizeArg.dropFirst("--capture-size=".count).split(separator: "x")
            guard size.count == 2, let w = Int(size[0]), let h = Int(size[1]),
                w >= 1280, h >= 720, w <= 4096, h <= 3072, w % 2 == 0, h % 2 == 0 else {
                throw NSError(domain: "Invalid capture size", code: 7)
            }
            config.width = w
            config.height = h
        }
        guard config.width >= 1280, config.height >= 720 else {
            throw NSError(domain: "Refusing undersized recording from transient window bounds", code: 8)
        }
        print("CAPTURE_GEOMETRY window=\(window.frame) output=\(config.width)x\(config.height)")
        config.minimumFrameInterval = CMTime(value: 1, timescale: 60)
        config.queueDepth = 5
        config.showsCursor = !args.contains("--hide-system-cursor")
        config.capturesAudio = false
        let writer = try WindowWriter(url: url, width: config.width, height: config.height)
        let queue = DispatchQueue(label: "doya.reshoot.writer", qos: .userInteractive)
        let stream = SCStream(filter: filter, configuration: config, delegate: nil)
        try stream.addStreamOutput(writer, type: .screen, sampleHandlerQueue: queue)
        try await stream.startCapture()
        print("RECORDING_STARTED \(config.width)x\(config.height)")
        fflush(stdout)
        let deadline = Date().addingTimeInterval(seconds)
        while Date() < deadline && !FileManager.default.fileExists(atPath: url.path + ".stop") {
            try await Task.sleep(for: .milliseconds(200))
        }
        try await stream.stopCapture()
        await withCheckedContinuation { (done: CheckedContinuation<Void, Never>) in queue.async { done.resume() } }
        try await writer.finish(url: url)
        print("RECORDED frames=\(writer.frames) dropped=\(writer.dropped) \(url.path)")
    }
}
