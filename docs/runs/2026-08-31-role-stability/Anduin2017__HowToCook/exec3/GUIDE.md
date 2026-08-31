
# A Programmer's Guide to Cooking at Home

## Why This Guide Exists

Programmers who try to cook by following recipes found around the internet run
into a familiar frustration: the instructions are written in wildly
inconsistent styles, and halfway through a step an ingredient shows up that
was never mentioned in the list at the top. For anyone used to reading formal,
well-specified languages, that kind of ambiguity is exactly the kind of bug a
type checker would catch.

The project this guide is drawn from set out to fix that by collecting common
home dishes and rewriting them with clearer, more precise descriptions —
treating a recipe the way a programmer treats a spec: inputs declared up
front, steps ordered and unambiguous, no surprise dependencies introduced
mid-function. It is also explicitly community-maintained: contributions,
corrections, and new dishes are meant to come from anyone who wants to help
grow it, in the spirit of an open-source repository rather than a single
author's personal notebook.

This guide reorganizes that material into something you can read start to
finish: the mindset, how to get set up, the foundational kitchen skills worth
learning before you touch a recipe, and a full catalog of the dishes on offer,
grouped the way a cookbook's table of contents would group them.

## Philosophy: Treat a Recipe Like a Spec

The core complaint driving this project is a familiar one to anyone who has
debugged someone else's code: a recipe that reads fine on a first pass but
turns out to have hidden requirements. A step calls for "the sauce" before any
sauce was ever defined. A quantity is given in "a bit," with no unit and no
fallback. The fix proposed here is not more prose — it's tighter
specification. Ingredients are declared before they're used. Quantities are
concrete. Steps are ordered so that nothing you need appears out of nowhere.

Reading the recipes with that lens in mind is the whole point: you're not
expected to intuit anything a professional chef would take for granted.
If a recipe doesn't tell you, it isn't assumed you should already know it.

## Browsing and Running the Recipe Collection

The dishes in this collection are meant to be browsed through a companion
visual website that presents them for easy reading (found at
`howtocook.aiursoft.com`). If you'd rather run a local copy of that viewer
yourself, the project ships a container image. After installing a container
runtime, the standard sequence is:

1. Pull the viewer image.
2. Run it as a background container, mapping port 5000 on the host to port
   5000 in the container.
3. Log in with the documented default credentials (`admin` /
   `Admin@123456!`) — and change them if you leave the service running.
4. Give it roughly half an hour after starting up before expecting the full
   recipe index to be searchable; the first run builds its index in the
   background.

That's the entire local deployment story: no build step, no configuration
file to hand-edit, just pull the image, run it, and wait for indexing.

## Contributing New Recipes

The project treats new recipes the same way a codebase treats new modules:
copy an existing template rather than writing one from scratch. There is a
dedicated example recipe meant purely as a skeleton to fork — its structure
(ingredient list, step order, notes section) is what every other recipe in
the catalog below follows. Fixes to existing recipes are handled the way any
small code fix would be: find the problem, edit it directly, and submit it
as a pull request rather than filing a report and waiting for someone else to
make the change.

## Kitchen Fundamentals (Read These Before You Cook)

Before diving into individual dishes, the collection sets aside a set of
foundational topics — the equivalent of a language's standard library docs.
These are meant to be read once and then reused across dozens of recipes,
rather than re-explained in every single one:

- **Kitchen preparation** — getting your space, tools, and pantry ready
  before you start cooking anything.
- **How to wash dishes** — treated as a real skill worth documenting, not an
  afterthought.
- **How to decide what to eat right now** — a lightweight decision procedure
  for picking a dish when you're staring at a full catalog and can't choose.
- **Pressure cookers** — what they're for and how to use one safely.
- **Air fryers** — the appliance that shows up constantly in the meat and
  staple sections below.
- **Removing gamey or fishy odors** — a technique referenced across many meat
  and seafood dishes rather than repeated in each one.
- **Food safety** — the baseline rules assumed by every recipe that follows.
- **Microwaves** — treated as a legitimate primary cooking tool, not just a
  reheating device; several dishes below are built entirely around one.
- **Blanching** — a prep step used across the vegetable and meat sections.
- **Stir-frying and pan-frying** — the two techniques behind the majority of
  the vegetable and meat dishes in the catalog.
- **Cold-tossing (liangban)** — the technique behind the "cold salad"-style
  dishes scattered through the vegetable and meat lists.
- **Marinating** — timing and technique shared across most meat dishes.
- **Steaming** — the technique behind the custards, eggs, breads, and whole
  fish that appear throughout the catalog.
- **Boiling** — simple, but with its own timing and doneness pitfalls worth
  documenting once.

Learning these once means that every dish below can reference "blanch the
vegetable" or "marinate for twenty minutes" without re-deriving what that
means from scratch — the same reasoning behind factoring shared logic into a
shared function.

## The Recipe Catalog

What follows is the full index of dishes in the collection, organized by
category exactly as the source project organizes them. Names are given in
English with the closest common English name or transliteration; the actual
step-by-step instructions for each dish live in that dish's own recipe page
and are outside the scope of this index — think of this section as a table
of contents rather than the chapters themselves.

### Vegetable Dishes

Candied Toffee Potatoes; Blanched Choy Sum; Cabbage Stir-Fried with Egg and
Vermicelli; Spinach Stir-Fried with Egg; Silky Scrambled Eggs; Stir-Fried
Eggplant; Stir-Fried Greens; Scallion Pan-Fried Tofu; Crispy-Skin Tofu; Di San
Xian (Sautéed Potato, Eggplant and Green Pepper); Dry-Pot Cauliflower; Mixed
Mushrooms in Oyster Sauce; Lettuce in Oyster Sauce; Braised Winter Melon;
Braised Eggplant; Tiger-Skin Peppers; Edamame Boiled with Preserved Plum;
Steamed Egg Custard (stovetop, microwave, and steam-oven versions); Egg Drop;
Cucumber Stir-Fried with Egg and Ham; Braised Eggplant and Potato; Home-Style
Japanese (Egg) Tofu; Salt-and-Pepper Corn; "Coin" Fried Eggs; Enoki Mushroom
and Egg Tofu Clay Pot; Chives Stir-Fried with Egg; Roasted Eggplant; Green
Beans with Preserved Olive Vegetable and Minced Pork; Chili-Smashed Preserved
Egg; Cold Tofu Salad; Cold Cucumber Salad; Cold Enoki Mushroom Salad; Cold
Wood Ear Mushroom Salad; Cold Celtuce Salad; Cold Romaine Lettuce Salad;
Preserved Egg with Tofu; Kabayaki-Style Eggplant; Emperor Qianlong's Cabbage;
Celery with Tea Tree Mushroom; Plain Stir-Fried Cauliflower; Steamed Pumpkin;
Northern Shaanxi Stewed Green Beans; Baby Cabbage in Superior Broth;
Hand-Torn Cabbage; Water-and-Oil Braised Vegetables; Corn with Pine Nuts;
Plain Stir-Fried Green Beans; Hot and Sour Shredded Potato; Celery Stir-Fried
with Garlic; Water Spinach with Garlic; Broccoli with Garlic; Tomatoes Tossed
with Sugar; Celtuce Leaf Pancake; Tomato and Egg Stir-Fry; Tomato and Tofu
Soup; Zucchini Stir-Fried with Egg; Diced Lotus Root Stir-Fry; Onion
Stir-Fried with Egg; Indian Bottle Gourd Balls; Indian Aloo Gobi;
Oil-and-Vinegar Fried Egg.

### Meat Dishes

Orleans-Style Roasted Chicken Thighs; Macanese Minced Beef Rice; Pakistani
Beef Curry; Napa Cabbage and Pork Stewed with Glass Noodles; Steamed Spare
Ribs in Black Bean Sauce; Steamed White Eel in Black Bean Sauce;
Scallion-Braised Chicken Thighs; Braised Pork Knuckle with Bone; Winter
Melon Stuffed with Meat; Romaine Lettuce with Dace Fish in Black Bean Sauce;
Tomato Meat Sauce; Steamed Pork with Rice Flour; Braised Pork with Fermented
Bean Curd; Dry-Fried Young Chicken; Kung Pao Chicken; Sweet and Sour Pork;
Cantonese Braised Beef Brisket with Radish; Guizhou Chili Chicken; Guilin's
Eighteen Stuffed Dishes; Snow Peas Stir-Fried with Chinese Sausage; Black
Pepper Beef Fillet; Braised Chicken Wings; Braised Pork Belly (a simple
version and a southern-style version); Braised Pork Trotters; Hunan
Home-Style Braised Pork Belly; Tiger-Skin Pork Knuckle; Cucumber Stir-Fried
with Pork; Braised Chicken (Huangmen style); Butter Chicken; Anhui-Style
Braised Pork Belly; Twice-Cooked Pork; Beef Stir-Fried with Hot Peppers;
"Screaming" Spicy Bullfrog; Pan-Seared Lamb Chops; Ginger Stir-Fried Chicken;
Ginger-Scallion Poached Chicken; Soy-Braised Beef; Soy-Braised Spare Ribs;
Water Bamboo Stir-Fried with Pork; Salt-and-Pepper Pork Strips; Wasabi Giant
River Prawns; Curry Beef; Roasted Chicken Wings; Coca-Cola Chicken Wings;
Air-Fryer Crispy Freshly-Marinated Fried Chicken; Mouth-Watering ("Saliva")
Chicken; Pork Stir-Fried with Chili Peppers; Mom's Braised Pig's Trotters;
Old-Style Guobaorou; Cold-Eaten Spicy Rabbit; Lychee Pork; Cold Shredded
Chicken Salad; Marinated Cold Dishes (Lu Cai); Lamb Ribs Stewed with Radish;
Numbing-Spicy Hot Pot Stir-Fry; Mapo Tofu; Ants Climbing a Tree; Steamed Pork
Belly with Preserved Mustard Greens; Cheese and Bacon Macaroni; Pan-Seared
Steak; Farmhouse Fragrant Bowl; Beer Duck (a classic and a country-style
version); Guizhou-Style Chinese Sausage with Baby Cabbage; Stuffed Green
Peppers; Green Pepper and Potato Stir-Fried with Pork; Steamed Mandarin
Fish; Steamed Meat Patty with Egg; Pig-Slaughtering Feast; Shanxi Oil-Passed
Pork; Shangzhi Preserved Vegetable with Pork; Sliced Potato Stir-Fried with
Lean Pork; Boiled Beef in Chili Oil; Boiled Sliced Pork in Chili Oil; Garlic
Scapes Stir-Fried with Minced Pork; Taiwanese Braised Pork Rice; Sweet and
Sour Pork Tenderloin; Sweet and Sour Spare Ribs; Stuffed River Snails; Sweet
and Spicy Roasted Whole Wings; Spare Ribs Stewed with Potatoes; Boneless
Chicken Feet; Beef Brisket with Tomato; Beef Stewed with Tomato and Potato;
Country-Style Beer Duck; Celery and Dried Tofu Stir-Fried with Pork; Shredded
Pork with Dried Tofu; Chicken Stir-Fried with Shiitake Mushrooms; Pan-Fried
Pork Belly; Spicy Chicken Feet Clay Pot; Xiangqi Rice-Flour Duck; Quick-Fried
Yellow Beef; Quick-Fried Chicken Liver; Hunan-Style Quick-Fried Pork; Pork
Stir-Fried with Thai Chili; Crispy Fried Pork; Xinjiang Big Plate Chicken;
Duck Blood Stir-Fry; Braised Noodles with Lamb Ribs; Onion Stir-Fried with
Pork; Italian Roast Chicken; Fish-Fragrant Eggplant; Fish-Fragrant Shredded
Pork; Lamb Belly Clay Pot with Bean Curd Sticks; Pork Skin Aspic (Jelly);
Pork Braised with Pickled Cabbage; Chu Hou Braised Beef Brisket; Cumin Beef;
Zibo-Style Barbecue; Drunken Spare Ribs.

### Aquatic (Fish, Shellfish & Seafood)

Blanched Shrimp; Bream Stewed with Tofu; Razor Clams with Egg; Scallion-Braised
Sea Cucumber; Mandarin Fish with Scallion Oil; Pan-Fried Argentine Red
Shrimp; Braised Carp; Braised Fish; Braised Fish Head; Butter Pan-Fried
Shrimp; Grilled Fish; Crab Stewed in Soy Sauce; Wasabi Butter Giant River
Prawns; Curry Stir-Fried Crab; Carp Stewed with Napa Cabbage; Steamed Sea
Bass; Steamed Oysters; Crab and Pork Clay Pot; Boiled Fish in Chili Oil;
Garlic Shrimp; Garlic Butter Shrimp; Sweet and Sour Carp; Microwave Black Cod
with Scallion and Ginger; Pan-Fried Culter Fish; Sizzling Oil Shredded Eel;
Crawfish; Yangshuo Beer Fish; Oil-Braised Prawns.

### Breakfast

Tea Eggs; Pan-Fried Glutinous Rice Cake with Egg; Longan and Red Date
Congee; Korean "Mayak" Marinated Eggs; Egg Sandwich; Pan-Fried Dumplings
(Potstickers); Tuna Salad Sandwich; Air-Fryer Toast; American Scrambled
Eggs; Milk Oatmeal; Chinese Scallion Pancake; Boiled Corn; Scotch Egg;
Sunny-Side-Up Egg; Soft-Boiled Egg; Toast with Jam; The Perfect Boiled Egg;
Microwave Mug Cake; Microwave Poached Egg; Microwave Steamed Egg; Onsen Egg;
Oatmeal Egg Pancake; Italian Sausage Shakshuka; Steamed Flower Rolls; Steamed
Water Egg.

### Staples (Rice, Noodles & Bread)

Stir-Fried Instant Noodles; Stir-Fried Rice Noodles; Stir-Fried Mung Bean
Jelly; Stir-Fried Flatbread; Stir-Fried Rice Cakes; Stir-Fried Spaghetti;
Scallion Oil Noodles; Omurice; Egg Fried Rice; Rice Cooker Salmon Rice;
Braised Noodles with Green Beans; Korean Bibimbap; Henan Steamed Noodles;
Red Kidney Bean Rice; Ham Rice Ball; Basic Milk Bread; Eggplant and Pork
Pancake; Bonito Flake and Nori Corn Rice; Soy-Sauce-Tossed Buckwheat Noodles;
Chive Pockets; Coca-Cola Fried Rice; Air-Fryer Teriyaki Chicken Rice;
Fermented Rice Wine with Small Rice Balls; Lao Gan Ma Chili Sauce Noodles;
"Old Friend" Pork Rice Noodles; Pan-Fried Flatbread; Litti Chokha; Cold Mung
Bean Jelly; River Snail Rice Noodles; Spicy Low-Fat Buckwheat Noodles;
Sesame Oil Noodles; Rice Cooker Steamed Rice; Stovetop Steamed Rice; Pizza
Dough; Hot Dry Noodles; Japanese Beef Bowl; Japanese Curry Rice; Meat and Egg
Rice Bowl; Shaanxi Oil-Splashed Noodles; Sesame Baked Flatbread; Handmade
Dumplings; Hot and Sour Fern Root Noodles; Noodle Soup; Microwave Claypot
Rice with Chinese Sausage; Tomato and Egg Noodle Soup; Fresh Pork Shumai;
Salted Pork and Vegetable Rice; Yangzhou Fried Rice; Spaghetti Bolognese;
Indian Naan; Indian Pilaf; Chickpea Fritters; Zhajiangmian; Teriyaki Chicken
Thigh Rice; Steamed Braised Noodles; Chinese Stuffed Pancake; Lard-Tossed
Rice; Instant Noodles with Egg.

### Semi-Finished / Convenience Foods

Pre-Made Pasta; Air-Fryer Frozen Chicken Wingettes; Air-Fryer Frozen Lamb
Chops; Store-Bought-Shell Egg Tarts; Cold Skin Noodles; Beef Tallow Hot Pot
Base; Frozen Wontons; Frozen Dumplings; Frozen Glutinous Rice Balls; Fried
French Fries.

### Soups & Congee

Yellowhead Catfish and Tofu Soup; Dried Tangerine Peel and Rib Soup (two
recipe variants); Tomato Beef Egg Drop Soup; Thickened Shiitake Mushroom
Soup; Cucumber and Preserved Egg Soup; Enoki Mushroom Soup; Mushroom-Stewed
Squab; Laba Congee; Russian-Style Borscht; Rice Congee; Cream of Mushroom
Soup; Bitter Melon and Rib Soup; Rib Soup with Yam and Corn; Century Egg and
Lean Pork Congee; Poached Meatball Soup; Tomato and Egg Soup; Millet Congee;
Lamb Soup; White Fungus and Lotus Seed Congee; Corn and Rib Soup; "Vermilion
Bird" Soup; Seaweed Egg Drop Soup.

### Drinks

Baba Citrus Tea; Passion Fruit and Orange Mocktail; Sichuan Ice Jelly
(Bingfen); Pineapple Coffee Mocktail; Winter Melon Tea; "Seaside Sunset"
Cocktail; Gin Fizz; Gin and Tonic; Fermented Rice Wine; Rum and Coke;
Milk Tea; Lemonade; Avocado Lassi; Kiwi and Spinach Mocktail; Sugared
Coconut Smoothie; Sour Plum Drink (a from-scratch and an instant-mix
version); Thai "ChaTraMue"-Style Black Tea; Mango Pomelo Sago; Indian Masala
Chai; Long Island Iced Tea; B-52 Cocktail; Mojito.

### Sauces & Other Ingredients

Strawberry Jam; Scallion Oil; Simple Caramelized Sugar Color; Garlic Soy
Sauce; Sweet and Sour Sauce; Oil-Splashed Chili Flakes; Fried Shortening
Paste; Skewer Dipping Sauce; Cane Sugar Syrup.

### Desserts

Oreo Ice Cream; Strawberry Ice Cream; Candied Taro; Guilinggao (Herbal
Jelly); Red Grapefruit Cake; Sweet Carrot Cake; Coffee Coconut Milk Pudding;
Baked Egg Tart; Oven-Baked Basque Cheesecake; Margaret Cookies; Konjac Cake;
Chiffon Cake; Yogurt Panna Cotta; Tiramisu; No-Mixer Honey Bread; Nougat
Snowflake Crisp; English Scones; Taro Mochi (Snow Skin Cake); Fried Milk.

## Advanced Topics

Once the fundamentals feel routine and a good number of the dishes above have
been cooked, the collection points toward a handful of deeper topics for
sharpening technique further:

- **Auxiliary ingredient techniques** — the supporting-cast ingredients and
  how to use them well.
- **Advanced professional terminology** — the vocabulary professional cooks
  use that home recipes usually skip explaining.
- **Making caramelized sugar color** — a technique used to color and flavor
  braised meat dishes, treated in more depth than the "simple version" listed
  among the sauces above.
- **Judging oil temperature** — reading heat without a thermometer, a skill
  assumed by a large share of the stir-fry and deep-fry dishes above.

## Related Tools & Companion Projects

The catalog above has, over time, spawned a small ecosystem of tools built on
top of it, worth knowing about even though they are outside the scope of this
guide itself:

- A visual recipe viewer with online preview and PDF export.
- Two "AI assistant as personal chef" integrations (one in JavaScript, one in
  Python) that let an AI planning tool draw on this same recipe collection to
  plan daily meals.
- A "what should I eat today" decision-support tool.
- An open, community-contributed recipe API for anyone who wants to build on
  top of a structured version of this data.
- An offline pregnancy nutrition and meal-tracking app.
- A second, independent "what to eat" decision tool.
- An immersive cooking companion app built on this catalog, aimed at turning
  "this looks good but I'll never actually cook it" into a guided,
  step-by-step session in the kitchen.

## A Note on Scope

This guide is an index and orientation layer, not a substitute for the
individual recipe pages themselves. It tells you what exists, how the
collection is organized, what to learn before you start, and what philosophy
governs how a well-written recipe here should read — but the actual
ingredient lists, quantities, and step-by-step instructions for any given
dish live on that dish's own page and are not reproduced here. Treat this
document the way you'd treat a package index rather than the packages
themselves.
