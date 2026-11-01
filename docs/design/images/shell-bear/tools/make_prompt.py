import sys,json
items=json.load(open(sys.argv[1]))
head='''Use your built-in image generation tool (not any API key, not a script, no network calls) to generate %d separate images and save them as PNG files in the folder raw/ with exactly these names: %s.

These are small APP MENU ICONS (shown at 32-40px) of the ドヤAI polar bear mascot "Doya-kun". Character for ALL images (match the attached references ref-hello.png, ref-point.png, ref-working.png exactly for the face and outfit):
- White fluffy polar bear with round ears, wide blue visor goggles (blue frame, cyan rim, dark navy lens). The eyes are ONLY glowing cyan shapes inside the goggle lens. Small black nose, small open happy mouth.
- White hoodie with a blue </> symbol on the chest.
Icon style for ALL images (keep identical across the set):
- Same comic sticker illustration as the references but SIMPLIFIED for small size: bold thick navy outlines (about 3x thicker than the references), flat colors with only light blue shading, NO halftone dots, NO background doodles, NO code windows, NO clouds, NO gears, NO sparkles.
- Only the bear plus the ONE prop described, nothing else. The bear's head is large (chibi proportions, head about 45 percent of the figure), upper body or three-quarter body, the action must be readable as a silhouette.
- Colors: white, navy #1a2b5f outlines, blue #0066ff and cyan #00c8ff for props, at most one small yellow #ffd400 accent. 
- Centered, the bear and prop together fill about 88 percent of the square, square 1:1, 1024x1024.
- Background: perfectly flat solid pure magenta #ff00ff everywhere outside the character and prop (no gradient, no shadow, no floor, no white sticker border). It will be keyed out, so never use magenta, pink or purple on the character or prop.
- ABSOLUTELY NO text, letters, numerals, words, logos or watermarks anywhere (the </> symbol on the hoodie is allowed). Screens, papers and cards must be blank or show only simple lines and shapes.

Images:
'''
names=', '.join('raw/%s.png'%i['id'] for i in items)
out=head%(len(items),names)
for n,i in enumerate(items,1):
    out+='%d. raw/%s.png — %s\n'%(n,i['id'],i['pose'])
out+='\nSave all files and then list the raw/ folder.\n'
print(out)
