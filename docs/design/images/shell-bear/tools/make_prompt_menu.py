import sys,json
items=json.load(open(sys.argv[1]))
names=', '.join('menu/%s.png'%i['id'] for i in items)
refs=', '.join('ref-%s.png'%i['id'] for i in items)
out='''Use your built-in image generation tool (not any API key, not a script, no network calls) to generate %d separate images and save them as PNG files in the folder menu/ with exactly these names: %s.

Each image is a TIGHT CLOSE-UP version of an existing app menu icon, redrawn so it stays readable at a tiny 32x32 px size. The attached files %s are the full versions; image menu/<id>.png must be the close-up of ref-<id>.png. Keep exactly the same character, prop, colors and line style as its reference.

Composition rules for ALL images (keep identical across the set):
- Show the polar bear "Doya-kun" only as HEAD AND SHOULDERS (a bust): round ears, wide blue visor goggles with glowing cyan eyes inside the lens, small nose and mouth, the top of the white hoodie. No legs, no lower body.
- The PROP is the hero: draw it BIG in the foreground, in front of the bear or held up next to the face, occupying at least 40 percent of the image area. The prop must be instantly recognizable as a silhouette at 32 px. Simplify the prop to its essential shape with bold lines and few details.
- The bear's head may be smaller than in the reference (about 35 to 45 percent of the image area). It is fine if the prop overlaps part of the hoodie or the chin, but keep both goggles visible.
- Everything (bear bust + prop) must fit fully inside the square with a small margin; nothing cut off by the image edge. The bust ends in a smooth rounded shoulder line at the bottom.
- Bold thick navy #1a2b5f outlines (thicker than the reference), flat colors, light blue shading only, no halftone dots, no background doodles, no sparkles, no motion lines unless they are part of the prop.
- Colors: white, navy, blue #0066ff, cyan #00c8ff, at most one small yellow #ffd400 accent.
- Square 1:1, 1024x1024. Background: perfectly flat solid pure magenta #ff00ff everywhere outside the bear and prop (no gradient, no shadow, no floor, no white border). Never use magenta, pink or purple on the bear or prop.
- ABSOLUTELY NO text, letters, numerals, words, logos or watermarks (the </> symbol on the hoodie may be hidden or shown). Screens, papers and cards blank or with simple lines only.

Images:
''' % (len(items), names, refs)
for n,i in enumerate(items,1):
    out+='%d. menu/%s.png — close-up of ref-%s.png. Action: %s\n'%(n,i['id'],i['id'],i['pose'])
out+='\nSave all files and then list the menu/ folder.\n'
print(out)
