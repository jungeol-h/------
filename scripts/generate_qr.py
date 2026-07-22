import qrcode
from PIL import Image, ImageDraw, ImageFont
import os

def create_qr():
    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=15,
        border=4,
    )
    qr.add_data('https://gooooookee.com/')
    qr.make(fit=True)

    qr_img = qr.make_image(fill_color="black", back_color="white").convert('RGB')
    
    # Title text
    title = '"나매크" 웹/앱 QR코드'
    
    # Create a new image with white background, taller to fit the title
    width, height = qr_img.size
    new_width = width
    new_height = height + 150 # Add space for text
    
    new_img = Image.new('RGB', (new_width, new_height), color='white')
    
    # Paste the QR code onto the new image
    new_img.paste(qr_img, (0, 150))
    
    # Try to load a font that supports Korean
    font_paths = [
        "/System/Library/Fonts/AppleSDGothicNeo.ttc",
        "/Library/Fonts/AppleGothic.ttf",
        "/System/Library/Fonts/Supplemental/AppleGothic.ttf"
    ]
    
    font = None
    for path in font_paths:
        if os.path.exists(path):
            try:
                font = ImageFont.truetype(path, 50)
                break
            except Exception as e:
                pass
                
    if font is None:
        font = ImageFont.load_default()
        
    # Add text
    draw = ImageDraw.Draw(new_img)
    
    try:
        text_bbox = draw.textbbox((0, 0), title, font=font)
        text_width = text_bbox[2] - text_bbox[0]
        text_height = text_bbox[3] - text_bbox[1]
    except AttributeError:
        text_width, text_height = draw.textsize(title, font=font)
        
    # Center the text
    text_x = (new_width - text_width) / 2
    text_y = (150 - text_height) / 2
    
    draw.text((text_x, text_y), title, fill="black", font=font)
    
    # Save the image
    new_img.save("qrcode_with_title.png")
    print("Successfully generated qrcode_with_title.png")

if __name__ == "__main__":
    create_qr()
