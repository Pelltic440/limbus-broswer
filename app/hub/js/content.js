/* Static content for the hub: Sinners, greetings, links, story list.
   Greeting lines are original fan writing in each Sinner's manner of speech. They are not lines from the game. */
(function (root) {
  "use strict";
  var SINNERS = [
    { k: "yisang", n: "Yi Sang", no: 1, c: "#d4e1e8" },
    { k: "faust", n: "Faust", no: 2, c: "#ffb1b4" },
    { k: "don", n: "Don Quixote", no: 3, c: "#ffef23" },
    { k: "ryoshu", n: "Ryōshū", no: 4, c: "#ff4a3d" },
    { k: "meursault", n: "Meursault", no: 5, c: "#7c93ff" },
    { k: "honglu", n: "Hong Lu", no: 6, c: "#5bffde" },
    { k: "heathcliff", n: "Heathcliff", no: 7, c: "#b18cf0" },
    { k: "ishmael", n: "Ishmael", no: 8, c: "#ff9500" },
    { k: "rodion", n: "Rodion", no: 9, c: "#e2525a" },
    { k: "sinclair", n: "Sinclair", no: 11, c: "#c5d93b" },
    { k: "outis", n: "Outis", no: 12, c: "#6fc487" },
    { k: "gregor", n: "Gregor", no: 13, c: "#d2925a" }
  ];
  var BIRTHDAYS = { "4-4": "ryoshu", "5-5": "meursault", "6-6": "honglu", "8-8": "ishmael", "9-9": "rodion", "2-29": "gregor" };

  var LINES = {
    yisang: {
      morning: ["Morning hath arrived unbidden, as it ever does. I shall follow where thou leadest, Manager.", "The light is thin at this hour. It suiteth quiet work."],
      afternoon: ["The day is half spent. I have been watching the dust turn in the window; it is diligent, in its way.", "Shouldst thou need me, I am here. I was merely thinking."],
      evening: ["Evening. The hour at which a thought is loudest. What wouldst thou have of me?", "The lamps are lit. I find them kinder than the sun."],
      night: ["Thou art awake still? Then we are two. I shall not ask the reason.", "The night is long, and I am well acquainted with it."],
      poke: ["...Yes? I was listening. Mostly.", "I had a thought just now. It hath left. No matter.", "Thou needest not prod. I am not asleep, though I grant it resembleth sleep."]
    },
    faust: {
      morning: ["Good morning, Manager. Faust has already reviewed today's schedule. You need only follow it.", "You are awake. Faust expected as much, within a margin of twenty minutes."],
      afternoon: ["It is the afternoon. Faust knows what you are about to ask, but please, ask it anyway.", "Productivity declines after midday in most people. Faust is not most people."],
      evening: ["Good evening. Faust has compiled the day's results. They are acceptable.", "The evening is an efficient time to plan. Faust has, naturally, already planned."],
      night: ["It is late. Faust is aware that telling you to rest will not work, and so will not.", "Faust does not require as much sleep as you believe. You, however, do."],
      poke: ["Faust knows everything. That includes why you pressed that.", "If you have a question, state it. Faust will simplify the answer.", "Yes, Faust is here. Faust is generally here."]
    },
    don: {
      morning: ["Good morrow, Manager! The sun doth rise, and so must we! What villainy shall we smite today?", "Hark! A new day! Verily, I have been awake for hours polishing mine armour of justice!"],
      afternoon: ["The noonday sun doth shine upon the righteous! Onward, Manager, adventure waiteth for no one!", "Manager! I have a most splendid notion for the afternoon, and it involveth Fixers!"],
      evening: ["The eve draweth nigh, yet justice knoweth no curfew! What sayest thou, Manager?", "A fine evening for tales of valour! Shall I recount the deeds of the great Fixers?"],
      night: ["Fear not the dark, Manager! I shall stand the night watch! ...I am not sleepy in the slightest!", "The stars are out! Even they keep vigil for the weak. As do I!"],
      poke: ["Ha! Thou hast summoned me! Speak thy quest!", "Was that a call to adventure? I do believe it was!", "Careful, Manager! Rocinante is freshly shined!"]
    },
    ryoshu: {
      morning: ["M.I.B. ...Morning is boring. Wake me when something bleeds.", "You're up, Clock. Fine. Don't talk until I finish this cigarette."],
      afternoon: ["S.T.W. Standing around is a waste. Point me at something.", "Daylight flattens everything. No shadows, no art."],
      evening: ["Better. The light's turning red. That's worth looking at.", "E.I.F. ...Evening is fine. Don't make it tedious."],
      night: ["N.I.B. Night is best. Things look honest in the dark.", "Still awake, Clockhead? Then be quiet about it."],
      poke: ["T.M.A. ...Touch me again. See what happens.", "What. If it isn't art, it can wait.", "Hmph. You have nerve. I'll allow it once."]
    },
    meursault: {
      morning: ["It is morning. I am ready. I await instructions.", "Good morning. The sunlight is at an acceptable angle. Please state the first task."],
      afternoon: ["It is the afternoon. No orders have been given in some time. I am noting that, not complaining.", "The sun is high. I will continue as directed."],
      evening: ["It is evening. The day's tasks are complete unless you say otherwise.", "Good evening. If there is nothing further, I will prepare a meal."],
      night: ["It is night. You are not asleep. I was not told whether this is a problem.", "The sun is down. I am still available."],
      poke: ["Yes.", "You pressed that. I do not know what result you expected.", "I am here. An order would be clearer."]
    },
    honglu: {
      morning: ["Good morning, Manager! Oh, do people really get up this early without anyone waking them? How novel!", "Ah, morning! At home someone would have brought tea by now. I rather like fetching my own."],
      afternoon: ["Good afternoon! I was just watching the others work. Everyone looks so serious, it's wonderful.", "Is it lunchtime already? Time moves so quickly when nobody is scolding you."],
      evening: ["Good evening! The sky is such a lovely colour. Is it always free to look at?", "Evening already? What a pleasant day it's been. Nothing terrible happened to me at all!"],
      night: ["Oh, you're still up! So am I. It's so quiet here at night, isn't it?", "They say you shouldn't stay up late, but nobody ever told me why."],
      poke: ["Oh! Hello! Did you need something, or did you just want to say hi?", "Haha, that tickles. I think. Should it?", "Is this one of those games everyone knows except me?"]
    },
    heathcliff: {
      morning: ["Oi. Yer up, then. 'Bout time.", "Mornin'. Don't expect me to be chipper about it."],
      afternoon: ["What're we doin', standin' about? Give us somethin' to hit, Clockhead.", "Afternoon. I'm starvin'. Fish and chips, and I ain't askin' twice."],
      evening: ["Evenin'. Long day, that. Not that I'm complainin'. Much.", "Sun's goin' down. Good. Was gettin' in me eyes."],
      night: ["Still up? ...Yeah. Me an' all. Leave it.", "Go on, get some kip. I'll keep an eye out. Not for you, mind."],
      poke: ["Oi! Hands off!", "What? What d'you want?", "Do that again an' see what yer get."]
    },
    ishmael: {
      morning: ["Morning. Let's get through the list before somebody sets something on fire.", "You're up. Good. One of us has to keep this lot on schedule."],
      afternoon: ["Afternoon. *sigh* Half the day gone and half the work with it. Typical.", "If you're about to make a questionable call, say it now so I can object properly."],
      evening: ["Evening. We made it through another one. I'll take that.", "The light on the water would be good right about now. ...Never mind. What do you need?"],
      night: ["It's late. You know that, right? I'm not going to nag. Much.", "Night watch isn't so bad. At sea it was worse."],
      poke: ["Yes? Use your words.", "*sigh* What is it this time.", "If you please, don't do that."]
    },
    rodion: {
      morning: ["Mornin', Dante~ Breakfast first, work after. That's the rule, and I just made it up.", "Rise and shine! Someone has to earn today's snack money, and it might as well be all of us."],
      afternoon: ["Afternoon, Manager dear. Feeling lucky? I've got a bet going on who trips first today.", "Ugh, it's the slow part of the day. Tell me something fun or feed me. Your pick."],
      evening: ["Evening~ Good work today. Now, about dinner. I'm thinking: a lot of it.", "The day's done! Time for the important things. Food. Cards. More food."],
      night: ["Still up, Dante? Sit with me, then. Nights go faster with company.", "Can't sleep? Me neither. Don't worry about it. Want a snack?"],
      poke: ["Ooh, bold! Buy me dinner first~", "Hm? Need big sis Rodya for something?", "Careful, that's one favour you owe me now."]
    },
    sinclair: {
      morning: ["G-good morning, Manager. Um, I already checked the schedule. Just in case.", "Good morning! I, um, I slept all right. I think. I hope you did too."],
      afternoon: ["Good afternoon. Is, is there anything I can help with? I don't mind.", "Oh! Manager. S-sorry, I didn't see you there. It's a nice afternoon."],
      evening: ["Good evening. We did all right today, didn't we? I think we did.", "It's evening already. I'm, um, glad everyone's back in one piece."],
      night: ["You're still awake? M-me too. It's hard to sleep sometimes.", "Um, you should rest, Manager. I'll, I'll try to as well."],
      poke: ["Ah! Y-yes? Did I do something wrong?", "Oh, um. Hello.", "P-please don't startle me like that..."]
    },
    outis: {
      morning: ["Executive Manager. Oh-six-hundred has passed. The unit is assembled and awaiting your orders.", "Good morning, Manager. I have prepared three plans for today. I recommend the first."],
      afternoon: ["Midday report: discipline among the ranks is lacking, as usual. I will see to it.", "Manager. I trust you are not considering the others' suggestions over mine."],
      evening: ["Evening, Manager. Today's operation is concluded. A debriefing would be appropriate.", "The day is done. Some here would call that reason to slack. I do not."],
      night: ["Still at your post at this hour. That is the bearing of a commander, Manager.", "I will take the night watch. A veteran does not need the sleep the recruits do."],
      poke: ["Manager. State your business.", "Is this a drill? I was not informed of a drill.", "I will overlook that. This once."]
    },
    gregor: {
      morning: ["Mornin', Manager bud. Coffee first, yeah? ...Bugger, we're out.", "Whoop, you're up early. Me? I never really went down."],
      afternoon: ["Afternoon. Nothing's on fire, nobody's dead. I'd call that a good shift so far.", "Hey, Manager. Take five. Nobody's gonna write you up. Well. Outis might."],
      evening: ["Evening, bud. Long one, huh? Pull up a seat.", "Sun's down. Time for a smoke and not thinking too hard."],
      night: ["Can't sleep either? Yeah. It gets like that.", "Late, huh. I'll keep you company. I'm an old hand at being awake."],
      poke: ["Whoa, hey. Easy on the arm.", "Shoot, you startled me. What's up?", "Heh. Need something, bud?"]
    }
  };

  var SINS = { Wrath: "#fe3b30", Lust: "#fb7a1e", Sloth: "#f7c729", Gluttony: "#9dfe2b", Gloom: "#19c7ee", Pride: "#3b7bff", Envy: "#b04bf0" };
  var KEYWORDS = { burn: "#ff6b35", bleed: "#e5484d", tremor: "#e8b33d", rupture: "#94d82d", sinking: "#3bc9db", poise: "#a5d8ff", charge: "#7c8cff" };
  var SEASONS = { 1: "Orientation", 2: "Reminiscence", 3: "Bon Voyage", 4: "Clear All Cathy", 5: "Oblivion", 6: "Zàng Huā Yín", 7: "Kumo no ito", 8: "PUNCTUM" };
  function seasonLabel(se) {
    if (se === "std") return "Standard Fare";
    var m = /^s(\d+)(e?)$/.exec(se);
    if (m) return "Season " + m[1] + " · " + (SEASONS[m[1]] || "") + (m[2] ? " (event)" : "");
    m = /^w(\d+)$/.exec(se);
    if (m) return "Walpurgis Night " + m[1];
    return se;
  }
  /* Faction = the group named at the front of an Identity's title. */
  var FACTIONS = [
    ["House of Spiders", /House of Spiders|^The Index Proxy/], ["Haute Couture", /^Haute Couture/], ["Heishou Pack", /^Heishou Pack/],
    ["Hongyuan", /Hongyuan/], ["Blade Lineage", /^Blade Lineage/], ["Kurokumo Clan", /^Kurokumo/], ["W Corp.", /^W Corp/], ["R Corp.", /^R Corp/],
    ["N Corp.", /^N Corp|One Who (Shall )?Grip/], ["T Corp.", /^T Corp/], ["K Corp.", /^K Corp/], ["G Corp.", /^G Corp/], ["S Corp.", /^S Corp/],
    ["Lobotomy E.G.O", /^Lobotomy E\.G\.O|^Lobotomy Corp/], ["LCE", /^LCE /], ["Liu Assoc.", /^Liu /], ["Shi Assoc.", /^Shi /], ["Cinq Assoc.", /^Cinq /],
    ["Seven Assoc.", /^Seven /], ["Zwei Assoc.", /^Zwei /], ["Dieci Assoc.", /^Dieci /], ["Devyat' Assoc.", /^Devyat/], ["Öufi Assoc.", /^Öufi/],
    ["Dawn / Wedge Office", /^Dawn Office|^Wedge Office/], ["Full-Stop Office", /^Full-Stop/], ["The Thumb", /^The Thumb/], ["The Middle", /^The Middle/],
    ["The Ring", /^The Ring/], ["The Index", /^The Index Proselyte/], ["La Manchaland", /La Manchaland/], ["Wuthering Heights", /Wuthering Heights|^Edgar Family|^Wild Hunt|^Dead Rabbits/],
    ["The Pequod", /Pequod|^Twinhook/], ["Molar", /^Molar/], ["Rosespanner Workshop", /^Rosespanner/], ["LCCB", /^LCCB/], ["District 20", /^District 20/],
    ["MultiCrack Office", /^MultiCrack/], ["LCB (base)", /^LCB Sinner/]
  ];
  function factionOf(name) {
    for (var i = 0; i < FACTIONS.length; i++) if (FACTIONS[i][1].test(name)) return FACTIONS[i][0];
    return "Other";
  }

  var APPS = [
    { n: "Steam", u: "https://store.steampowered.com/", c: "#66c0f4" },
    { n: "WhatsApp", m: "WA", u: "https://web.whatsapp.com/", c: "#25d366" },
    { n: "Spotify", u: "https://open.spotify.com/", c: "#1ed760" },
    { n: "ChatGPT", m: "GPT", u: "https://chatgpt.com/", c: "#b8c2cc" },
    { n: "Gemini", u: "https://gemini.google.com/", c: "#8ab4f8" },
    { n: "YouTube", m: "YT", u: "https://www.youtube.com/", c: "#ff4e45" },
    { n: "Claude", u: "https://claude.ai/", c: "#d97757" }
  ];
  var LIMBUS = [
    { n: "Limbus Wiki", u: "https://limbuscompany.wiki.gg/", d: "wiki.gg, the reference for kits and lore" },
    { n: "Prydwen", u: "https://www.prydwen.gg/limbus-company/", d: "Tier list, reviews, guides" },
    { n: "Great Limbus Library", u: "https://gll-fun.com/limbus/en/", d: "GLL: database, tier lists, team builder" },
    { n: "Limbus Deck", u: "https://limbusdeck.com/en", d: "Deck builder, schedule, Limbusdle" },
    { n: "Official news (Steam)", u: "https://steamcommunity.com/app/1973530/allnews/", d: "Project Moon's notices" },
    { n: "Limbus Company on X", u: "https://x.com/LimbusCompany_B", d: "Official account" },
    { n: "Steam store page", u: "https://store.steampowered.com/app/1973530/Limbus_Company/", d: "The game itself" },
    { n: "r/limbuscompany", u: "https://www.reddit.com/r/limbuscompany/", d: "Community" }
  ];
  var LIMBUS_MORE = [
    { n: "Prydwen tier list", u: "https://www.prydwen.gg/limbus-company/tier-list" },
    { n: "GLL tier list", u: "https://gll-fun.com/limbus/en/tierlist/identities/" },
    { n: "Limbus Deck tier list", u: "https://limbusdeck.com/en/tier-list" },
    { n: "Limbus Deck teams", u: "https://limbusdeck.com/en/recommended-parties" },
    { n: "Limbus Deck schedule", u: "https://limbusdeck.com/en/schedule" },
    { n: "Wiki: Walpurgis Night", u: "https://limbuscompany.wiki.gg/wiki/Walpurgis_Night" },
    { n: "Wiki: Mirror Dungeon", u: "https://limbuscompany.wiki.gg/wiki/Mirror_Dungeon" },
    { n: "Wiki: Identity data table", u: "https://limbuscompany.wiki.gg/wiki/List_of_Identities/Data" }
  ];
  var ENGINES = [
    { k: "google", n: "Google", u: "https://www.google.com/search?q=" },
    { k: "wiki", n: "Limbus Wiki", u: "https://limbuscompany.wiki.gg/index.php?search=" },
    { k: "youtube", n: "YouTube", u: "https://www.youtube.com/results?search_query=" },
    { k: "claude", n: "Claude", u: "https://claude.ai/new?q=" },
    { k: "chatgpt", n: "ChatGPT", u: "https://chatgpt.com/?q=" }
  ];
  var CANTOS = [
    ["c1", "Canto I", "The Outcast"], ["c2", "Canto II", "The Unloving"], ["c3", "Canto III", "The Unconfronting"],
    ["c4", "Canto IV", "The Unchanging"], ["c5", "Canto V", "The Evil Defining"], ["c6", "Canto VI", "The Heartbreaking"],
    ["c7", "Canto VII", "The Dream Ending"], ["c8", "Canto VIII", "The Surrendered Witnessing"], ["c9", "Canto IX", "The Unsevering"],
    ["c10", "Canto X", "The Gaze Bearing"]
  ];
  var DAILIES = [["mod", "Turn Enkephalin into Modules"], ["thread", "3 Thread Luxcavation bonus runs"], ["exp", "EXP Luxcavation"], ["missions", "Daily missions"], ["tickets", "Spend training tickets"]];
  var WEEKLIES = [["md1", "Mirror Dungeon bonus 1"], ["md2", "Mirror Dungeon bonus 2"], ["md3", "Mirror Dungeon bonus 3"], ["wmissions", "Weekly missions"], ["mail", "Claim the weekly Lunacy mail"]];

  root.LCBContent = { SINNERS: SINNERS, BIRTHDAYS: BIRTHDAYS, LINES: LINES, SINS: SINS, KEYWORDS: KEYWORDS, seasonLabel: seasonLabel,
    FACTIONS: FACTIONS, factionOf: factionOf, APPS: APPS, LIMBUS: LIMBUS, LIMBUS_MORE: LIMBUS_MORE, ENGINES: ENGINES, CANTOS: CANTOS,
    DAILIES: DAILIES, WEEKLIES: WEEKLIES };
})(typeof window !== "undefined" ? window : globalThis);
