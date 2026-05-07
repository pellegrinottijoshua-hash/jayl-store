// ── Social-organized prompt library ──────────────────────────────────────────
// Structure: social[platform][productType].{ image: [], video: [] }
// Each prompt: { id, name, prompt }
// Template vars: {PRODUCT_NAME}, {PRODUCT_TYPE}, {COLOR}, {COLLECTION}

export const generatePrompts = {
  social: {

    // ── TikTok ─────────────────────────────────────────────── 3 img + 3 vid ──
    tiktok: {
      tshirt: {
        image: [
          {
            id: 'tt-ts-i1',
            name: 'TikTok T-Shirt — Trend Drop',
            prompt: 'Keep the exact t-shirt design unchanged. Show the {COLOR} {PRODUCT_NAME} tee worn by a Gen-Z person dancing in a neon-lit room, vertical 9:16, motion blur on background, sharp on shirt, TikTok aesthetic, phone camera quality with slight grain',
          },
          {
            id: 'tt-ts-i2',
            name: 'TikTok T-Shirt — Street OOTD',
            prompt: 'Keep the exact t-shirt design unchanged. Full-body OOTD shot: {COLOR} {PRODUCT_NAME} tee styled with baggy jeans and chunky sneakers, urban sidewalk, natural daylight, vertical crop 9:16, candid Gen-Z fashion energy, no extra text',
          },
          {
            id: 'tt-ts-i3',
            name: 'TikTok T-Shirt — Close-Up Detail',
            prompt: 'Extreme close-up of the {PRODUCT_NAME} graphic on the chest of a {COLOR} tee, fingers gently framing the design, shallow depth of field, warm indoor light, handheld phone aesthetic, 9:16 vertical',
          },
        ],
        video: [
          {
            id: 'tt-ts-v1',
            name: 'TikTok T-Shirt — Transition Reveal',
            prompt: 'Fast-cut TikTok transition: person standing in plain tee, quick camera whip, reveals {COLOR} {PRODUCT_NAME} tee styled head-to-toe, punchy color grade, vertical 9:16, 5 seconds, energetic hook in first frame',
          },
          {
            id: 'tt-ts-v2',
            name: 'TikTok T-Shirt — Dance Lifestyle',
            prompt: 'Person dancing in {COLOR} {PRODUCT_NAME} t-shirt, neon background, slow-motion hair movement, confident energy, TikTok vertical 9:16, 5 seconds, fashion brand aesthetic',
          },
          {
            id: 'tt-ts-v3',
            name: 'TikTok T-Shirt — Unboxing Hook',
            prompt: 'Close-up hands unfolding {COLOR} {PRODUCT_NAME} tee from minimal packaging, ASMR satisfying fabric sound implied, clean table surface, vertical 9:16, 5 seconds, punchy reveal moment',
          },
        ],
      },
      mug: {
        image: [
          {
            id: 'tt-mug-i1',
            name: 'TikTok Mug — Morning Ritual',
            prompt: 'Close-up of {PRODUCT_NAME} mug held in both hands, steam rising, cozy morning bedroom background, warm golden light, vertical 9:16, phone camera grain, lifestyle content aesthetic',
          },
          {
            id: 'tt-mug-i2',
            name: 'TikTok Mug — Desk Vibe',
            prompt: '{PRODUCT_NAME} mug on a Gen-Z aesthetic desk — LED lights in background, laptop stickers, plants, warm bokeh, close-up 9:16, lifestyle flat angle, TikTok room aesthetic',
          },
          {
            id: 'tt-mug-i3',
            name: 'TikTok Mug — Design Detail',
            prompt: 'Extreme close-up macro of the {PRODUCT_NAME} design printed on the mug surface, ceramic texture visible, dramatic side light, shallow DOF, vertical crop, product showcase quality',
          },
        ],
        video: [
          {
            id: 'tt-mug-v1',
            name: 'TikTok Mug — Pour Reveal',
            prompt: 'Slow-motion coffee pour into {PRODUCT_NAME} mug, steam rising, dark moody background, satisfying and hypnotic, vertical 9:16, 5 seconds, lifestyle brand quality',
          },
          {
            id: 'tt-mug-v2',
            name: 'TikTok Mug — Morning Mood',
            prompt: 'Hands wrapping around {PRODUCT_NAME} mug on a cozy morning, camera slowly pulls back revealing aesthetic room, warm tones, vertical 9:16, 5 seconds, peaceful atmosphere',
          },
          {
            id: 'tt-mug-v3',
            name: 'TikTok Mug — Rotation Product',
            prompt: '{PRODUCT_NAME} mug slowly rotates 360° on marble surface, dramatic top-down light, fog machine atmosphere, vertical 9:16, 5 seconds, product reveal energy',
          },
        ],
      },
      art: {
        image: [
          {
            id: 'tt-art-i1',
            name: 'TikTok Art Print — Gallery Moment',
            prompt: '{PRODUCT_NAME} art print mounted on a clean white wall, person standing beside it pointing at the work, surprised/happy reaction, vertical 9:16, natural interior light, relatable home decor moment',
          },
          {
            id: 'tt-art-i2',
            name: 'TikTok Art Print — Unboxing Flat',
            prompt: '{PRODUCT_NAME} art print partially unrolled on a light wood floor, tissue paper and tube visible, hands holding edges, overhead 9:16, natural light, satisfying reveal aesthetic',
          },
          {
            id: 'tt-art-i3',
            name: 'TikTok Art Print — Wall Inspo',
            prompt: '{PRODUCT_NAME} art print on a gallery wall surrounded by plants, fairy lights and aesthetic objects, cozy Gen-Z room, vertical 9:16, moody warm light, room tour energy',
          },
        ],
        video: [
          {
            id: 'tt-art-v1',
            name: 'TikTok Art Print — Living Artwork',
            prompt: 'The {PRODUCT_NAME} artwork comes alive: elements animate subtly — colors shift, lines draw themselves, particles float out of the print. Camera slowly zooms in. Vertical 9:16, 5 seconds, magical aesthetic',
          },
          {
            id: 'tt-art-v2',
            name: 'TikTok Art Print — Hang Time-lapse',
            prompt: 'Fast-cut time-lapse: bare wall → measuring tape → nail → {PRODUCT_NAME} print hung perfectly and stepped back from, satisfying completion moment, vertical 9:16, 5 seconds',
          },
          {
            id: 'tt-art-v3',
            name: 'TikTok Art Print — Room Transform',
            prompt: 'Before/after room transformation: dull empty wall → same wall with {PRODUCT_NAME} print, plants and cozy objects styled around it, smooth transition wipe, vertical 9:16, 5 seconds',
          },
        ],
      },
      tote: {
        image: [
          {
            id: 'tt-tote-i1',
            name: 'TikTok Tote — Street Style',
            prompt: '{PRODUCT_NAME} tote bag slung over shoulder of person in a Gen-Z OOTD, urban background, natural daylight, vertical 9:16, candid energy, casual street style',
          },
          {
            id: 'tt-tote-i2',
            name: 'TikTok Tote — Bag Dump',
            prompt: 'Contents of {PRODUCT_NAME} tote bag spilled aesthetically on surface — book, headphones, snacks, lip balm, sunglasses — overhead flat lay, vertical 9:16, relatable what\'s in my bag energy',
          },
          {
            id: 'tt-tote-i3',
            name: 'TikTok Tote — Market Haul',
            prompt: '{PRODUCT_NAME} tote bag held up at a farmers market or flea market, overflowing with fresh flowers and produce, warm outdoor light, vertical 9:16, lifestyle content, natural joy',
          },
        ],
        video: [
          {
            id: 'tt-tote-v1',
            name: 'TikTok Tote — Pack with Me',
            prompt: 'Fast-cut "pack with me": hands loading items into {PRODUCT_NAME} tote — books, laptop, snacks — satisfying organization, vertical 9:16, 5 seconds, trending sound implied',
          },
          {
            id: 'tt-tote-v2',
            name: 'TikTok Tote — On The Go',
            prompt: 'Person walks through busy street swinging {PRODUCT_NAME} tote, slow-motion hair and bag movement, golden hour, vertical 9:16, 5 seconds, effortlessly cool',
          },
          {
            id: 'tt-tote-v3',
            name: 'TikTok Tote — Design Reveal',
            prompt: 'Hands hold up {PRODUCT_NAME} tote, slowly unfold and stretch it flat to reveal full design, then flip to back, close-up detail shot, vertical 9:16, 5 seconds',
          },
        ],
      },
    },

    // ── Instagram ──────────────────────────────────────────── 3 img + 2 vid ──
    instagram: {
      tshirt: {
        image: [
          {
            id: 'ig-ts-i1',
            name: 'Instagram T-Shirt — Editorial Portrait',
            prompt: 'Keep the exact t-shirt design unchanged. Fashion editorial portrait: model wearing {COLOR} {PRODUCT_NAME} tee, clean minimal studio, dramatic side lighting, white cyclorama, sharp on garment, square 1:1 or portrait 4:5, campaign quality',
          },
          {
            id: 'ig-ts-i2',
            name: 'Instagram T-Shirt — Golden Hour Street',
            prompt: 'Keep the exact t-shirt design unchanged. {COLOR} {PRODUCT_NAME} tee worn by confident person walking through sunlit city street, golden hour, shallow depth of field, Fujifilm grain, fashion editorial quality, portrait 4:5',
          },
          {
            id: 'ig-ts-i3',
            name: 'Instagram T-Shirt — Flat Lay Aesthetic',
            prompt: 'Keep the exact t-shirt design unchanged. {COLOR} {PRODUCT_NAME} tee laid flat on white linen, styled with matching accessories — sunglasses, watch, earrings, plant leaf — overhead, natural window light, clean Instagram aesthetic, square 1:1',
          },
        ],
        video: [
          {
            id: 'ig-ts-v1',
            name: 'Instagram T-Shirt — Reel Lifestyle',
            prompt: 'Short Instagram Reel: model in {COLOR} {PRODUCT_NAME} tee walks toward camera on golden hour street, slow-motion last frame freeze, cinematic color grade, 4:5 vertical, 6 seconds',
          },
          {
            id: 'ig-ts-v2',
            name: 'Instagram T-Shirt — Studio Reveal',
            prompt: 'Minimal studio product reveal: {COLOR} {PRODUCT_NAME} tee on invisible mannequin, camera orbits slowly, dramatic lighting shifts, clean and luxe, 1:1 or 4:5, 6 seconds',
          },
        ],
      },
      mug: {
        image: [
          {
            id: 'ig-mug-i1',
            name: 'Instagram Mug — Styled Flat Lay',
            prompt: '{PRODUCT_NAME} mug on white marble surface, styled with coffee beans, small spoon and fresh flower, overhead editorial flat lay, natural window light, square 1:1, clean lifestyle aesthetic',
          },
          {
            id: 'ig-mug-i2',
            name: 'Instagram Mug — Café Moment',
            prompt: '{PRODUCT_NAME} mug on a wooden café table, open book beside it, soft window light, shallow depth of field, warm tones, lifestyle portrait 4:5, editorial café aesthetic',
          },
          {
            id: 'ig-mug-i3',
            name: 'Instagram Mug — Minimalist Product',
            prompt: '{PRODUCT_NAME} mug centered on clean white background, dramatic single light source from side creating shadow, pure product shot, square 1:1, studio quality, design clearly visible',
          },
        ],
        video: [
          {
            id: 'ig-mug-v1',
            name: 'Instagram Mug — Morning Ritual Reel',
            prompt: 'Soft lifestyle Reel: hands wrap around {PRODUCT_NAME} mug, steam rises, golden morning light through window, slow-motion steam, warm and inviting, 4:5, 6 seconds',
          },
          {
            id: 'ig-mug-v2',
            name: 'Instagram Mug — Product Orbit',
            prompt: '{PRODUCT_NAME} mug orbits slowly on minimal surface, soft studio light, elegant product focus, 1:1, 6 seconds, clean brand aesthetic',
          },
        ],
      },
      art: {
        image: [
          {
            id: 'ig-art-i1',
            name: 'Instagram Art Print — Gallery Wall',
            prompt: '{PRODUCT_NAME} art print as hero piece in a styled gallery wall, mix of frames and sizes, white wall, natural light, interior design aesthetic, portrait 4:5, aspirational home styling',
          },
          {
            id: 'ig-art-i2',
            name: 'Instagram Art Print — Minimalist Display',
            prompt: '{PRODUCT_NAME} art print solo on white wall above a minimal bench with single plant, architectural interior light, square 1:1, clean Nordic aesthetic, aspirational and editorial',
          },
          {
            id: 'ig-art-i3',
            name: 'Instagram Art Print — Design Close-Up',
            prompt: 'Close-up of {PRODUCT_NAME} art print, paper texture and print quality visible, dramatic raking light showing surface detail, square 1:1, product quality showcase',
          },
        ],
        video: [
          {
            id: 'ig-art-v1',
            name: 'Instagram Art Print — Aesthetic Room Reel',
            prompt: 'Camera slowly dollies through a styled room ending on {PRODUCT_NAME} art print on wall, warm ambient light, plants in foreground, cinematic depth, portrait 4:5, 6 seconds',
          },
          {
            id: 'ig-art-v2',
            name: 'Instagram Art Print — Animated Artwork',
            prompt: 'The {PRODUCT_NAME} artwork animates: elements gently float and shift, subtle color breathing, frame stays still. Dreamy loop, square 1:1, 6 seconds, museum atmosphere',
          },
        ],
      },
      tote: {
        image: [
          {
            id: 'ig-tote-i1',
            name: 'Instagram Tote — Editorial Carry',
            prompt: 'Model carrying {PRODUCT_NAME} tote in editorial fashion shot, golden hour urban background, shallow DOF, fashion brand quality, portrait 4:5, aspirational lifestyle',
          },
          {
            id: 'ig-tote-i2',
            name: 'Instagram Tote — Minimalist Product',
            prompt: '{PRODUCT_NAME} tote hanging on white wall hook, clean product shot, single dramatic light, shadow on wall, design fully visible, square 1:1, brand aesthetic',
          },
          {
            id: 'ig-tote-i3',
            name: 'Instagram Tote — Lifestyle Flat',
            prompt: '{PRODUCT_NAME} tote flat on light surface surrounded by lifestyle objects — sunglasses, keys, book, flowers — overhead editorial, natural light, square 1:1, curated aesthetic',
          },
        ],
        video: [
          {
            id: 'ig-tote-v1',
            name: 'Instagram Tote — Slow-Motion Swing',
            prompt: 'Slow-motion close-up of {PRODUCT_NAME} tote swinging as person walks, fabric movement, golden hour bokeh background, satisfying motion, portrait 4:5, 6 seconds',
          },
          {
            id: 'ig-tote-v2',
            name: 'Instagram Tote — Outfit Complete',
            prompt: 'Fashion Reel: outfit building sequence ending with {PRODUCT_NAME} tote added as final touch, camera pull-back reveals full look, portrait 4:5, 6 seconds, styling energy',
          },
        ],
      },
    },

    // ── Pinterest ──────────────────────────────────────────── 3 img + 0 vid ──
    pinterest: {
      tshirt: {
        image: [
          {
            id: 'pi-ts-i1',
            name: 'Pinterest T-Shirt — Outfit Inspo',
            prompt: 'Keep the exact t-shirt design unchanged. Full-body Pinterest outfit inspiration: {COLOR} {PRODUCT_NAME} tee styled in complete outfit on clean background, portrait 2:3, bright natural light, clean typography space at top, fashion blog aesthetic',
          },
          {
            id: 'pi-ts-i2',
            name: 'Pinterest T-Shirt — Aesthetic Flat Lay',
            prompt: 'Keep the exact t-shirt design unchanged. {COLOR} {PRODUCT_NAME} tee in styled flat lay with complementary accessories and objects, portrait 2:3, soft natural light, Pinterest mood board aesthetic, high contrast clean',
          },
          {
            id: 'pi-ts-i3',
            name: 'Pinterest T-Shirt — Lookbook Collage',
            prompt: 'Keep the exact t-shirt design unchanged. 3-panel vertical Pinterest collage: top = full outfit, middle = fabric detail close-up, bottom = styling inspiration context. {COLOR} {PRODUCT_NAME} tee as hero. Portrait 2:3, editorial quality',
          },
        ],
        video: [],
      },
      mug: {
        image: [
          {
            id: 'pi-mug-i1',
            name: 'Pinterest Mug — Cozy Home Styling',
            prompt: '{PRODUCT_NAME} mug in a cozy home setting — fireplace or window light, soft textures, book and candle nearby, portrait 2:3, warm Pinterest home aesthetic, aspirational and inviting',
          },
          {
            id: 'pi-mug-i2',
            name: 'Pinterest Mug — Recipe Flat Lay',
            prompt: '{PRODUCT_NAME} mug beside homemade cookies or pastry on marble, recipe ingredients scattered, overhead portrait 2:3, warm natural light, food & lifestyle Pinterest aesthetic',
          },
          {
            id: 'pi-mug-i3',
            name: 'Pinterest Mug — Gift Guide Visual',
            prompt: '{PRODUCT_NAME} mug styled as a gift — ribbon, kraft tissue paper, small gift tag, warm bokeh background, portrait 2:3, Pinterest gift guide aesthetic, inviting and premium',
          },
        ],
        video: [],
      },
      art: {
        image: [
          {
            id: 'pi-art-i1',
            name: 'Pinterest Art Print — Dream Room Inspo',
            prompt: '{PRODUCT_NAME} art print as focal point of a Pinterest dream room — perfectly styled furniture, plants, texture layers, natural light, portrait 2:3, interior design aspirational quality',
          },
          {
            id: 'pi-art-i2',
            name: 'Pinterest Art Print — Framed Preview',
            prompt: '{PRODUCT_NAME} art print shown in multiple frame mockups — black frame, natural wood, white — on white wall, clean product comparison, portrait 2:3, e-commerce + editorial quality',
          },
          {
            id: 'pi-art-i3',
            name: 'Pinterest Art Print — Mood Board',
            prompt: '{PRODUCT_NAME} art print as hero of a curated Pinterest mood board collage: print + color swatches + texture + complementary objects. Portrait 2:3, editorial styling, brand aesthetic board',
          },
        ],
        video: [],
      },
      tote: {
        image: [
          {
            id: 'pi-tote-i1',
            name: 'Pinterest Tote — Sustainable Style',
            prompt: '{PRODUCT_NAME} tote bag styled in an eco-conscious Pinterest flat lay: reusable water bottle, produce, farmers market items, linen textures, portrait 2:3, warm natural light, sustainable lifestyle aesthetic',
          },
          {
            id: 'pi-tote-i2',
            name: 'Pinterest Tote — Fashion Board',
            prompt: '{PRODUCT_NAME} tote as part of a Pinterest fashion board: styled outfit suggestion with tote, shoes, accessories all laid flat, portrait 2:3, clean white background, editorial fashion',
          },
          {
            id: 'pi-tote-i3',
            name: 'Pinterest Tote — Gift Packaging',
            prompt: '{PRODUCT_NAME} tote as gift: tissue paper peeking from top, ribbon tied handle, dried flower included, clean background, portrait 2:3, premium gift giving aesthetic, Pinterest gift guide',
          },
        ],
        video: [],
      },
    },

    // ── Facebook ───────────────────────────────────────────── 3 img + 2 vid ──
    facebook: {
      tshirt: {
        image: [
          {
            id: 'fb-ts-i1',
            name: 'Facebook T-Shirt — Ad Visual',
            prompt: 'Keep the exact t-shirt design unchanged. Clean Facebook ad creative: {COLOR} {PRODUCT_NAME} tee on white background with the design clearly visible, professional product photography, landscape or square format, high contrast, e-commerce quality',
          },
          {
            id: 'fb-ts-i2',
            name: 'Facebook T-Shirt — Lifestyle Community',
            prompt: 'Keep the exact t-shirt design unchanged. Group of friends wearing {COLOR} {PRODUCT_NAME} tees in outdoor setting, laughing and candid, warm sunlight, community energy, square or landscape, broad appeal lifestyle',
          },
          {
            id: 'fb-ts-i3',
            name: 'Facebook T-Shirt — Product Detail Ad',
            prompt: 'Keep the exact t-shirt design unchanged. Facebook product carousel style: {COLOR} {PRODUCT_NAME} tee shown from multiple angles — front, back, side detail — clean white background, e-commerce quality, square 1:1',
          },
        ],
        video: [
          {
            id: 'fb-ts-v1',
            name: 'Facebook T-Shirt — Ad Reel',
            prompt: '15-second Facebook ad video: {COLOR} {PRODUCT_NAME} tee product reveal, lifestyle B-roll shots of person wearing it, clean text overlay space, landscape 16:9, professional ad quality',
          },
          {
            id: 'fb-ts-v2',
            name: 'Facebook T-Shirt — Community Reel',
            prompt: 'Warm community lifestyle video: diverse group wearing {COLOR} {PRODUCT_NAME} tees at outdoor event, candid moments, golden hour, landscape 16:9, 8 seconds, brand community feel',
          },
        ],
      },
      mug: {
        image: [
          {
            id: 'fb-mug-i1',
            name: 'Facebook Mug — E-Commerce Ad',
            prompt: '{PRODUCT_NAME} mug clean product shot on white background, design fully visible, professional studio lighting, square 1:1, Facebook e-commerce catalog quality',
          },
          {
            id: 'fb-mug-i2',
            name: 'Facebook Mug — Gift Occasion',
            prompt: '{PRODUCT_NAME} mug styled as perfect gift for occasion — birthday, holiday, office — warm inviting setting, ribbon or gift wrap, text space for offer overlay, landscape 16:9 or square',
          },
          {
            id: 'fb-mug-i3',
            name: 'Facebook Mug — Lifestyle Relatable',
            prompt: 'Relatable lifestyle moment with {PRODUCT_NAME} mug: person at home working from laptop, mug beside keyboard, cozy and real, landscape 16:9, broad-appeal content',
          },
        ],
        video: [
          {
            id: 'fb-mug-v1',
            name: 'Facebook Mug — Ad Creative',
            prompt: 'Facebook video ad: {PRODUCT_NAME} mug product close-up, pour shot, hands holding in cozy setting, 15 seconds, landscape 16:9, clear product focus, text overlay space',
          },
          {
            id: 'fb-mug-v2',
            name: 'Facebook Mug — Gift Idea Reel',
            prompt: 'Facebook Reel: "{PRODUCT_NAME} — the perfect gift" concept, mug wrapped, opened, person surprised and happy, landscape 16:9, 8 seconds, gift occasion energy',
          },
        ],
      },
      art: {
        image: [
          {
            id: 'fb-art-i1',
            name: 'Facebook Art Print — Room Ad',
            prompt: '{PRODUCT_NAME} art print displayed in a beautiful living room, aspirational but accessible, couple looking at it appreciatively, landscape 16:9, warm interior light, relatable home improvement',
          },
          {
            id: 'fb-art-i2',
            name: 'Facebook Art Print — Product Ad',
            prompt: '{PRODUCT_NAME} art print product shot: print unrolled or framed, white background, design clearly visible, landscape 16:9 or square, e-commerce quality, text overlay space',
          },
          {
            id: 'fb-art-i3',
            name: 'Facebook Art Print — Before/After',
            prompt: 'Before/after Facebook creative: bland empty wall → same wall beautifully styled with {PRODUCT_NAME} art print and decor, side-by-side square format, high impact transformation',
          },
        ],
        video: [
          {
            id: 'fb-art-v1',
            name: 'Facebook Art Print — Transform Ad',
            prompt: 'Facebook video ad: room transformation — before boring wall, after {PRODUCT_NAME} art print styled on it, smooth transition, landscape 16:9, 10 seconds, clear impact',
          },
          {
            id: 'fb-art-v2',
            name: 'Facebook Art Print — Product Showcase',
            prompt: '{PRODUCT_NAME} art print product showcase video: unboxing → framing → hanging → stepping back to admire. Landscape 16:9, 12 seconds, satisfying process',
          },
        ],
      },
      tote: {
        image: [
          {
            id: 'fb-tote-i1',
            name: 'Facebook Tote — Product Ad',
            prompt: '{PRODUCT_NAME} tote bag clean product shot on white background, design fully visible front and back, professional lighting, square 1:1, Facebook catalog quality',
          },
          {
            id: 'fb-tote-i2',
            name: 'Facebook Tote — Lifestyle Broad',
            prompt: '{PRODUCT_NAME} tote used in relatable everyday scenario — grocery shopping, commuting, park — diverse person, natural daylight, landscape 16:9, broad appeal, friendly energy',
          },
          {
            id: 'fb-tote-i3',
            name: 'Facebook Tote — Eco Gift',
            prompt: '{PRODUCT_NAME} tote styled as eco-friendly gift alternative, products inside, ribbon tied, natural materials around it, square or landscape, sustainability messaging space',
          },
        ],
        video: [
          {
            id: 'fb-tote-v1',
            name: 'Facebook Tote — Day in Life',
            prompt: 'Day-in-life Facebook video: {PRODUCT_NAME} tote used from morning (market) to afternoon (park) to evening (cafe), montage cuts, landscape 16:9, 12 seconds, lifestyle story',
          },
          {
            id: 'fb-tote-v2',
            name: 'Facebook Tote — Pack & Go',
            prompt: 'Satisfying pack-for-the-day video: items loaded into {PRODUCT_NAME} tote, person grabs it and heads out door confidently, landscape 16:9, 8 seconds, relatable morning routine',
          },
        ],
      },
    },

    // ── Site ───────────────────────────────────────────────── 3 img + 2 vid ──
    site: {
      tshirt: {
        image: [
          {
            id: 'si-ts-i1',
            name: 'Site T-Shirt — Hero Product Shot',
            prompt: 'Keep the exact t-shirt design unchanged. Professional e-commerce hero: {COLOR} {PRODUCT_NAME} tee on invisible mannequin or flat lay, pure white background, even studio lighting, design razor sharp, suitable for product page main image',
          },
          {
            id: 'si-ts-i2',
            name: 'Site T-Shirt — Lifestyle Editorial',
            prompt: 'Keep the exact t-shirt design unchanged. Site hero editorial: {COLOR} {PRODUCT_NAME} tee worn by model in clean modern setting, professional photography quality, landscape or portrait, homepage-worthy image',
          },
          {
            id: 'si-ts-i3',
            name: 'Site T-Shirt — Detail Shot',
            prompt: 'Keep the exact t-shirt design unchanged. Product detail photography: close-up of {PRODUCT_NAME} graphic on {COLOR} tee, fabric texture visible, professional studio macro, suitable for product page gallery',
          },
        ],
        video: [
          {
            id: 'si-ts-v1',
            name: 'Site T-Shirt — Cinematic Reveal',
            prompt: 'Cinematic website hero video: {COLOR} {PRODUCT_NAME} tee dramatic product reveal, camera slowly pushes in, volumetric lighting, dark premium background, landscape 16:9, 6 seconds, autoplay loop quality',
          },
          {
            id: 'si-ts-v2',
            name: 'Site T-Shirt — Editorial Loop',
            prompt: 'Seamless editorial loop for website: model wearing {COLOR} {PRODUCT_NAME} tee, slow elegant walk through minimal studio, perfect loop point, landscape 16:9, 6 seconds, brand homepage quality',
          },
        ],
      },
      mug: {
        image: [
          {
            id: 'si-mug-i1',
            name: 'Site Mug — White Background Product',
            prompt: '{PRODUCT_NAME} mug on pure white background, professional 3/4 angle, even studio lighting, design clearly readable, multiple light sources for no harsh shadows, e-commerce product page quality',
          },
          {
            id: 'si-mug-i2',
            name: 'Site Mug — Context Lifestyle',
            prompt: '{PRODUCT_NAME} mug in aspirational context — morning desk setup, beautiful kitchen counter — design visible, professional photography, landscape 16:9 or portrait, site collection page quality',
          },
          {
            id: 'si-mug-i3',
            name: 'Site Mug — Multiple Angles',
            prompt: '{PRODUCT_NAME} mug shot from multiple precise angles: front (design facing), 3/4 angle, handle side, overhead — clean white background, consistent professional lighting, product page gallery series',
          },
        ],
        video: [
          {
            id: 'si-mug-v1',
            name: 'Site Mug — Product Orbit',
            prompt: '{PRODUCT_NAME} mug rotates 360° on clean studio surface, perfect lighting, 6 seconds seamless loop, landscape 16:9, premium e-commerce product video',
          },
          {
            id: 'si-mug-v2',
            name: 'Site Mug — Morning Story',
            prompt: 'Cinematic morning coffee ritual: {PRODUCT_NAME} mug as hero, pour → steam → hands cradling → sip, landscape 16:9, 8 seconds, premium brand storytelling for website',
          },
        ],
      },
      art: {
        image: [
          {
            id: 'si-art-i1',
            name: 'Site Art Print — Clean Product Shot',
            prompt: '{PRODUCT_NAME} art print flat on white background, professional product photography, even lighting, no shadows, colors accurate, landscape 16:9 or portrait 2:3, e-commerce main product image',
          },
          {
            id: 'si-art-i2',
            name: 'Site Art Print — Room Context',
            prompt: '{PRODUCT_NAME} art print in aspirational interior context: framed on wall of beautifully designed room, professional interior photography quality, shows scale and room fit, site collection or homepage quality',
          },
          {
            id: 'si-art-i3',
            name: 'Site Art Print — Frame Options',
            prompt: '{PRODUCT_NAME} art print shown in 3 frame options — black / wood / white — on neutral wall, clean professional product comparison, helps buyer visualize, e-commerce decision support',
          },
        ],
        video: [
          {
            id: 'si-art-v1',
            name: 'Site Art Print — Collection Hero',
            prompt: 'Website collection hero video: {PRODUCT_NAME} art print revealed in beautiful interior, camera slowly approaches, warm ambient light, landscape 16:9, 6 seconds, premium brand quality',
          },
          {
            id: 'si-art-v2',
            name: 'Site Art Print — Living Canvas',
            prompt: 'Website hero loop: {PRODUCT_NAME} art print on wall, elements gently animate — subtle color shifts and floating particles — dreamlike and premium, landscape 16:9, 8 seconds seamless loop',
          },
        ],
      },
      tote: {
        image: [
          {
            id: 'si-tote-i1',
            name: 'Site Tote — White Background Product',
            prompt: '{PRODUCT_NAME} tote bag on pure white background, professional studio photography, design clearly visible, shape well-defined, multiple light sources for accurate color and no harsh shadows, e-commerce product page quality',
          },
          {
            id: 'si-tote-i2',
            name: 'Site Tote — Lifestyle Context',
            prompt: '{PRODUCT_NAME} tote in aspirational lifestyle context — editorial setting, well-dressed person carrying it — professional photography, suitable for website collection or homepage feature',
          },
          {
            id: 'si-tote-i3',
            name: 'Site Tote — Interior Product',
            prompt: '{PRODUCT_NAME} tote hanging on designer coat hook or chair, well-lit interior, design visible, shows product in context, product page secondary image quality',
          },
        ],
        video: [
          {
            id: 'si-tote-v1',
            name: 'Site Tote — Product Showcase',
            prompt: '{PRODUCT_NAME} tote product showcase: 360° rotation on clean surface, then design close-up, then lifestyle shot, landscape 16:9, 8 seconds, premium e-commerce video',
          },
          {
            id: 'si-tote-v2',
            name: 'Site Tote — Brand Story',
            prompt: 'Website brand video: {PRODUCT_NAME} tote moves through beautiful scenes — market, park, coffee shop — seamless narrative loop, landscape 16:9, 8 seconds, brand homepage quality',
          },
        ],
      },
    },

    // ── YouTube ───────────────────────── 1 img (thumbnail) + 3 vid per type ──
    youtube: {
      tshirt: {
        image: [
          {
            id: 'yt-ts-i1',
            name: 'YouTube T-Shirt — Thumbnail',
            prompt: 'YouTube thumbnail: bold text space on left, {COLOR} {PRODUCT_NAME} tee worn by excited person on right, high contrast colors, thumbnail-optimized composition, 16:9 landscape, face clearly visible, eye-catching colors, professional thumbnail quality',
          },
        ],
        video: [
          {
            id: 'yt-ts-v1',
            name: 'YouTube T-Shirt — Intro Hook',
            prompt: 'YouTube video intro: dramatic reveal of {COLOR} {PRODUCT_NAME} tee — box opens, shirt unfolds, design revealed in close-up, cinematic quality, landscape 16:9, 8 seconds, YouTube watch-worthy',
          },
          {
            id: 'yt-ts-v2',
            name: 'YouTube T-Shirt — Review Lifestyle',
            prompt: 'YouTube try-on review style: person puts on {COLOR} {PRODUCT_NAME} tee, spins to show front and back, close-up on design, genuine authentic energy, landscape 16:9, 10 seconds, YouTube creator quality',
          },
          {
            id: 'yt-ts-v3',
            name: 'YouTube T-Shirt — Lookbook',
            prompt: 'YouTube lookbook B-roll: {COLOR} {PRODUCT_NAME} tee styled multiple ways in quick cuts, urban outdoor settings, golden hour, cinematic color grade, landscape 16:9, 12 seconds, fashion YouTube quality',
          },
        ],
      },
      mug: {
        image: [
          {
            id: 'yt-mug-i1',
            name: 'YouTube Mug — Thumbnail',
            prompt: 'YouTube thumbnail: {PRODUCT_NAME} mug with steam rising, exaggerated expression person behind it, bold eye-catching colors, text space on side, 16:9 landscape, high contrast thumbnail-optimized composition',
          },
        ],
        video: [
          {
            id: 'yt-mug-v1',
            name: 'YouTube Mug — Unboxing Intro',
            prompt: 'YouTube unboxing intro: {PRODUCT_NAME} mug unwrapped from packaging, held up to camera, design shown close-up with reaction, landscape 16:9, 10 seconds, authentic YouTube energy',
          },
          {
            id: 'yt-mug-v2',
            name: 'YouTube Mug — Morning Routine',
            prompt: 'YouTube morning routine B-roll: {PRODUCT_NAME} mug as hero prop — kettle pours, mug filled, taken to desk, cozy productive morning, landscape 16:9, 12 seconds, YouTube lifestyle quality',
          },
          {
            id: 'yt-mug-v3',
            name: 'YouTube Mug — Gift Review',
            prompt: 'YouTube gift review style: {PRODUCT_NAME} mug shown as gift — unwrapped, design admired, used immediately — genuine positive reaction, landscape 16:9, 12 seconds, gifting haul aesthetic',
          },
        ],
      },
      art: {
        image: [
          {
            id: 'yt-art-i1',
            name: 'YouTube Art Print — Thumbnail',
            prompt: 'YouTube thumbnail: {PRODUCT_NAME} art print dramatically lit on wall, person gesturing at it with amazed expression, bold composition, text space on side, 16:9 landscape, high contrast, clickable thumbnail quality',
          },
        ],
        video: [
          {
            id: 'yt-art-v1',
            name: 'YouTube Art Print — Room Transformation',
            prompt: 'YouTube room transformation: before shot of bare wall, process of hanging {PRODUCT_NAME} print, full after reveal with styled decor, camera pans across room, landscape 16:9, 15 seconds, satisfying YouTube makeover',
          },
          {
            id: 'yt-art-v2',
            name: 'YouTube Art Print — Unboxing',
            prompt: 'YouTube art unboxing: tube or flat pack opened, {PRODUCT_NAME} print carefully revealed and unrolled, held up to show full design, close-up detail shots, landscape 16:9, 12 seconds, collector energy',
          },
          {
            id: 'yt-art-v3',
            name: 'YouTube Art Print — Design Breakdown',
            prompt: 'YouTube B-roll for design breakdown video: {PRODUCT_NAME} art print extreme close-ups of different sections, camera explores the artwork in cinematic detail, landscape 16:9, 15 seconds, art appreciation quality',
          },
        ],
      },
      tote: {
        image: [
          {
            id: 'yt-tote-i1',
            name: 'YouTube Tote — Thumbnail',
            prompt: 'YouTube thumbnail: person holding up {PRODUCT_NAME} tote with excited expression, bold colors, design clearly visible, text space on left, 16:9 landscape, high contrast thumbnail-optimized',
          },
        ],
        video: [
          {
            id: 'yt-tote-v1',
            name: 'YouTube Tote — What\'s In My Bag',
            prompt: 'YouTube "What\'s In My Bag" style: {PRODUCT_NAME} tote emptied onto surface, each item laid out, then repacked, satisfying organization, landscape 16:9, 15 seconds, relatable YouTube content',
          },
          {
            id: 'yt-tote-v2',
            name: 'YouTube Tote — Haul Feature',
            prompt: 'YouTube haul B-roll: {PRODUCT_NAME} tote featured in shopping haul — shown, held, spun to show back, design close-up, set down with other items, landscape 16:9, 10 seconds, haul aesthetic',
          },
          {
            id: 'yt-tote-v3',
            name: 'YouTube Tote — Day With Me',
            prompt: 'YouTube "Day With Me" B-roll: {PRODUCT_NAME} tote accompanies through morning coffee, commute, market, park picnic, montage cuts, golden hour, landscape 16:9, 15 seconds, vlog aesthetic',
          },
        ],
      },
    },
  },
}
