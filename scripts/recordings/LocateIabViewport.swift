import AppKit
import ApplicationServices
import Foundation

func value(_ e: AXUIElement, _ key: String) -> CFTypeRef? {
    var out: CFTypeRef?
    guard AXUIElementCopyAttributeValue(e, key as CFString, &out) == .success else { return nil }
    return out
}
func frame(_ e: AXUIElement) -> [String: Double]? {
    guard let p=value(e,kAXPositionAttribute), let s=value(e,kAXSizeAttribute),
          CFGetTypeID(p)==AXValueGetTypeID(), CFGetTypeID(s)==AXValueGetTypeID() else {return nil}
    var point=CGPoint.zero;var size=CGSize.zero
    AXValueGetValue(p as! AXValue,.cgPoint,&point);AXValueGetValue(s as! AXValue,.cgSize,&size)
    return ["x":point.x,"y":point.y,"width":size.width,"height":size.height]
}
_ = NSApplication.shared
guard AXIsProcessTrusted() else { print("ACCESSIBILITY_NOT_AUTHORIZED"); exit(2) }
let apps=NSWorkspace.shared.runningApplications.filter{$0.bundleIdentifier=="com.openai.codex"}
print("matchedApps=\(apps.count)")
var found:[[String:Any]]=[]
for app in apps {
 let root=AXUIElementCreateApplication(app.processIdentifier)
 let windows=value(root,kAXWindowsAttribute) as? [AXUIElement] ?? []
 print("windows=\(windows.count)")
 for w in windows {
  print("windowTitle=\(value(w,kAXTitleAttribute) as? String ?? "") frame=\(frame(w) ?? [:])")
  var visited=0
  func walk(_ e:AXUIElement,_ depth:Int){
   visited += 1;guard depth<30 && visited<12000 else{return}
   let role=value(e,kAXRoleAttribute) as? String ?? ""
   let url=(value(e,kAXURLAttribute) as? URL)?.absoluteString ?? (value(e,kAXURLAttribute) as? String ?? "")
   if CommandLine.arguments.contains("--controls") && role=="AXButton" {
    let label=[kAXTitleAttribute,kAXDescriptionAttribute,kAXHelpAttribute].compactMap{value(e,$0) as? String}.joined(separator:" | ")
    if let f=frame(e), let wf=frame(w), f["height",default:0]>5, f["y",default:0]<wf["y",default:0]+100 {print("CONTROL \(label) frame=\(f)")}
   }
   if role=="AXWebArea" && url.hasPrefix("https://doya-ai.vercel.app/banner/dashboard") {
    found.append(["pid":app.processIdentifier,"role":role,"url":url,"viewport":frame(e) ?? [:],"window":frame(w) ?? [:],"windowTitle":value(w,kAXTitleAttribute) as? String ?? ""])
    return
   }
   for c in value(e,kAXChildrenAttribute) as? [AXUIElement] ?? [] {walk(c,depth+1)}
  }
  walk(w,0)
 }
}
let data=try JSONSerialization.data(withJSONObject:found,options:[.prettyPrinted,.sortedKeys])
print(String(decoding:data,as:UTF8.self))
