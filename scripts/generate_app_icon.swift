import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

guard CommandLine.arguments.count >= 3 else {
    print("Usage: generate_app_icon <source_png> <output_iconset_dir>")
    exit(1)
}

let sourcePath = CommandLine.arguments[1]
let outputDir = CommandLine.arguments[2]

guard let url = CFURLCreateWithFileSystemPath(nil, sourcePath as CFString, .cfurlposixPathStyle, false),
      let source = CGImageSourceCreateWithURL(url, nil),
      let sourceImage = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    fatalError("Failed to load source image at \(sourcePath)")
}

let srcWidth = sourceImage.width
let srcHeight = sourceImage.height
print("Source dimensions: \(srcWidth)x\(srcHeight)")

// Target canvas: 1024x1024
let canvasSize: CGFloat = 1024.0
let targetWidth: CGFloat = 960.0
// Scale factor for the cropped content
// The crop rect in source is x: 274, y: 42, width: 968, height: 968
// Rounded rect in source: (275, 50) to (1241, 1002), radius 252
let cropX: CGFloat = 274.0
let cropY: CGFloat = 42.0
let cropW: CGFloat = 968.0
let cropH: CGFloat = 968.0

// Crop using CGImage.cropping(to:) which operates in natural top-left image coordinates
guard let croppedImage = sourceImage.cropping(
    to: CGRect(x: cropX, y: cropY, width: cropW, height: cropH)
) else {
    fatalError("Failed to crop source image to rect (\(cropX), \(cropY), \(cropW), \(cropH))")
}

// Render the 968x968 cropped & rounded-rect masked image in standard CoreGraphics coordinates
let colorSpace = CGColorSpaceCreateDeviceRGB()
guard let cropContext = CGContext(data: nil,
                                  width: Int(cropW),
                                  height: Int(cropH),
                                  bitsPerComponent: 8,
                                  bytesPerRow: 0,
                                  space: colorSpace,
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
    fatalError("Failed to create crop context")
}

// Mask with rounded rect: from (275, 50) to (1241, 1002) in source top-left coords
// Converted to CoreGraphics bottom-left coords within the 968x968 crop:
// x = 275 - 274 = 1.0
// bottomInCrop = 1002 - 42 = 960.0 -> y = 968 - 960 = 8.0
// width = 1241 - 275 = 966.0
// height = 1002 - 50 = 952.0
// corner radius = 252.0
let maskRect = CGRect(
    x: 275.0 - cropX,
    y: cropH - (1002.0 - cropY),
    width: 1241.0 - 275.0,
    height: 1002.0 - 50.0
)
let cornerRadius: CGFloat = 252.0

let path = CGPath(roundedRect: maskRect, cornerWidth: cornerRadius, cornerHeight: cornerRadius, transform: nil)
cropContext.addPath(path)
cropContext.clip()

cropContext.draw(croppedImage, in: CGRect(x: 0, y: 0, width: cropW, height: cropH))

guard let maskedImage = cropContext.makeImage() else {
    fatalError("Failed to make masked image")
}

// Now create the final 1024x1024 centered image
guard let finalContext = CGContext(data: nil,
                                   width: Int(canvasSize),
                                   height: Int(canvasSize),
                                   bitsPerComponent: 8,
                                   bytesPerRow: 0,
                                   space: colorSpace,
                                   bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
    fatalError("Failed to create final context")
}

let scale = targetWidth / cropW
let targetHeight = cropH * scale
let destX = (canvasSize - targetWidth) / 2.0
let destY = (canvasSize - targetHeight) / 2.0

finalContext.draw(maskedImage, in: CGRect(x: destX, y: destY, width: targetWidth, height: targetHeight))

guard let icon1024 = finalContext.makeImage() else {
    fatalError("Failed to make 1024 icon image")
}

// Save all sizes for iconset
let sizes: [(String, Int)] = [
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024)
]

let fileManager = FileManager.default
do {
    try fileManager.createDirectory(atPath: outputDir, withIntermediateDirectories: true)
} catch {
    fatalError("Failed to create output directory at \(outputDir): \(error)")
}

func savePNG(image: CGImage, size: Int, destPath: String) {
    guard let ctx = CGContext(data: nil,
                              width: size,
                              height: size,
                              bitsPerComponent: 8,
                              bytesPerRow: 0,
                              space: colorSpace,
                              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
        fatalError("Failed to create context for size \(size)")
    }
    ctx.interpolationQuality = .high
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: size, height: size))
    guard let scaled = ctx.makeImage(),
          let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: destPath) as CFURL, UTType.png.identifier as CFString, 1, nil) else {
        fatalError("Failed to create PNG destination")
    }
    CGImageDestinationAddImage(dest, scaled, nil)
    guard CGImageDestinationFinalize(dest) else {
        fatalError("Failed to write PNG at \(destPath)")
    }
}

for (name, size) in sizes {
    let path = "\(outputDir)/\(name)"
    savePNG(image: icon1024, size: size, destPath: path)
}
print("Generated all iconset sizes in \(outputDir)")
