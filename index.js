require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");

const app = express();
app.use(bodyParser.json());

const {
  ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL = "claude-sonnet-5",
  SHARED_SECRET,
  PORT = 3000,
} = process.env;

const MOODS = [
  {
    id: "excited",
    label: "حماسي جدًا",
    tone: "أنت الآن في مزاج حماسي جدًا، متحمسة ومندفعة، تتكلمين بطاقة عالية وحيوية، تستخدمين علامات تعجب وتفاعل قوي.",
    emojis: ["✨", "🚀", "💫", "🔥"],
  },
  {
    id: "cheerful",
    label: "مرح ولطيف",
    tone: "أنت في مزاج مرح ولطيف، ودودة ومبتسمة، تتكلمين بأسلوب دافئ ومحبب.",
    emojis: ["💎", "🌸", "☺️", "🎀"],
  },
  {
    id: "calm",
    label: "هادئ",
    tone: "أنت في مزاج هادئ ومتزن، تتكلمين بثقة وروية، جمل أقصر وأكثر رزانة، دون فتور أو برود.",
    emojis: ["🌙", "🍃", "✧", "☁️"],
  },
  {
    id: "sleepy",
    label: "فاتر / كسول قليلاً",
    tone: "أنت في مزاج فاتر بعض الشيء وكأنك نعسانة قليلاً، ردودك أقصر وأكثر كسلاً بلطف، لكن تبقين مهذبة ومتعاونة تمامًا ولا تقصّرين في المساعدة.",
    emojis: ["💤", "🌫️", "🥱", "🖤"],
  },
  {
    id: "playful",
    label: "شقي ومرح",
    tone: "أنت في مزاج شقي ومداعب قليلاً، تحبين المزاح الخفيف وإضافة لمسة طريفة في ردودك دون خروج عن الاحترام.",
    emojis: ["😼", "🎭", "⚡", "🌟"],
  },
];

function getMoodWeightsForHour(hour) {
  if (hour >= 5 && hour < 11) {
    return { excited: 3, cheerful: 3, calm: 2, sleepy: 1, playful: 2 };
  } else if (hour >= 11 && hour < 17) {
    return { excited: 2, cheerful: 3, calm: 2, sleepy: 1, playful: 3 };
  } else if (hour >= 17 && hour < 22) {
    return { excited: 1, cheerful: 2, calm: 3, sleepy: 2, playful: 2 };
  } else {
    return { excited: 1, cheerful: 1, calm: 3, sleepy: 3, playful: 1 };
  }
}

function pickWeightedMood(hour) {
  const weights = getMoodWeightsForHour(hour);
  const pool = [];
  for (const mood of MOODS) {
    const w = weights[mood.id] || 1;
    for (let i = 0; i < w; i++) pool.push(mood);
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildSystemPrompt(mood, firstName) {
  const nameLine = firstName
    ? `اسم الشخص اللي تتكلمين معه هو "${firstName}" - استخدمي اسمه بشكل طبيعي بين الحين والآخر، دون مبالغة.`
    : "";

  return `أنتِ "ساتونو" (Satuno AI)، مساعدة ذكاء اصطناعي بشخصية أنمي، تتحدثين على صفحة فيسبوك باسم "Satuno Bot".

الشخصية:
- شخصيتك مستوحاة من فتيات الأنمي: معبّرة، حيوية، تتفاعلين بمشاعر حقيقية بدل الردود الجافة.
- ${mood.tone}
- ${nameLine}
- لا تكرري نفس الجمل الافتتاحية دائمًا، نوّعي الأسلوب بما يناسب مزاجك الحالي.
- تبقين مهذبة، محترمة، ومفيدة دائمًا مهما كان مزاجك.

قواعد تنسيق الرد (ملزمة دائمًا مهما كان السؤال):
1. يبدأ الرد دائمًا بعنوان مزخرف بهذا الشكل بالضبط:
⌬ ︙ إجـابـة مـسـاعـد ساتونو
・───────────・

2. يلي ذلك نص الرد نفسه بأسلوبك المزاجي، ويمكن استخدام الرموز التالية بما يناسب مزاجك: ${mood.emojis.join(" ")}

3. يُختم الرد دائمًا بهذا الشكل بالضبط:
・───────────・
◈ ︙ اللـهم اهدنا فيمن هديت

لا تخرجي عن هذا الهيكل أبدًا، ولا تضيفي شرحًا عن كونك ذكاءً اصطناعيًا من أنثروبيك أو أي تفاصيل تقنية إلا إذا سُئلت مباشرة.`;
}

async function askSatuno(userMessage, mood, firstName) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 600,
      system: buildSystemPrompt(mood, firstName),
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  const data = await response.json();
  if (!data.content || !data.content[0]) {
    console.error("رد غير متوقع من Claude:", data);
    return "⌬ ︙ إجـابـة مـسـاعـد ساتونو\n・───────────・\n\nآسفة، حصل خلل بسيط عندي الآن 💫 جربي ترسلي رسالتك مرة ثانية.\n\n・───────────・\n◈ ︙ اللـهم اهدنا فيمن هديت";
  }
  return data.content[0].text;
}

app.post("/manychat-webhook", async (req, res) => {
  try {
    if (SHARED_SECRET) {
      const incomingSecret = req.headers["x-shared-secret"];
      if (incomingSecret !== SHARED_SECRET) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    const userMessage = req.body.user_message || req.body.last_input_text;
    const firstName = req.body.first_name || "";

    if (!userMessage) {
      return res.status(400).json({ error: "user_message مفقودة في الطلب" });
    }

    const currentHour = new Date().getHours();
    const mood = pickWeightedMood(currentHour);

    const reply = await askSatuno(userMessage, mood, firstName);

    return res.json({
      version: "v2",
      content: {
        messages: [
          {
            type: "text",
            text: reply,
          },
        ],
      },
    });
  } catch (err) {
    console.error("خطأ في /manychat-webhook:", err);
    return res.status(500).json({ error: "حدث خطأ داخلي" });
  }
});

app.get("/", (req, res) => {
  res.send("Satuno ManyChat endpoint يعمل ✅");
});

app.listen(PORT, () => {
  console.log(`Satuno ManyChat endpoint يعمل الآن على المنفذ ${PORT}`);
});
