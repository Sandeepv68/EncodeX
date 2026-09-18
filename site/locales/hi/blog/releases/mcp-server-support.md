---
date: 2026-09-18
title: "EncodeX में बिल्ट-इन MCP सर्वर जुड़ा: AI को अपने मीडिया कन्वर्ज़न चलाने दें"
description: "EncodeX अब Model Context Protocol (MCP) सर्वर के साथ आता है, जिससे Claude, Cursor, VS Code और कस्टम agents आपके मीडिया को कन्वर्ट, कंप्रेस, ट्रिम और बैच-प्रोसेस कर सकते हैं — लोकली और सुरक्षित रूप से।"
tags:
  - release
  - mcp
  - ai
  - automation
---

# EncodeX में बिल्ट-इन MCP सर्वर जुड़ा: AI को अपने मीडिया कन्वर्ज़न चलाने दें

**रिलीज़:** 2026-09-18
**फ़ीचर:** बिल्ट-इन MCP सर्वर (stdio + embedded HTTP)

## एक नज़र में

EncodeX अब एक [Model Context Protocol](https://modelcontextprotocol.io) सर्वर के रूप में कार्य कर सकता है। यानी AI असिस्टेंट — Claude Desktop, Claude Code, Cursor, VS Code और कोई भी अन्य MCP-compatible client — सिर्फ़ एक साधारण भाषा में request देकर EncodeX के माध्यम से वीडियो कन्वर्ट कर सकते हैं, ऑडियो निकाल सकते हैं, इमेज कंप्रेस कर सकते हैं, क्लिप ट्रिम कर सकते हैं और बैच jobs manage कर सकते हैं।

और यह सब अब भी आपके कंप्यूटर पर होता है। कोई अपलोड नहीं, कोई क्लाउड नहीं, कोई अकाउंट नहीं।

---

## MCP से रोज़मर्रा का वर्कफ़्लो कैसे बदलता है

हमने EncodeX को आम लोगों के लिए FFmpeg कमांड लाइन हटाने के लिए बनाया है। **MCP सर्वर** आपके पहले से इस्तेमाल होने वाले टूल्स से आख़री "कौन सा बटन दबाऊँ?" वाली दिक्कत भी दूर कर देता है।

अगर आपने कभी ऐसा कुछ टाइप किया है:

> "`interview.mov` लो, उसका ऑडियो MP3 के रूप में निकालो, और एक कॉपी बनाओ जो ईमेल में आ जाए।"

…तो MCP-enabled असिस्टेंट अब वास्तव में यह *कर* सकता है — सही EncodeX टूल चुनकर, रूपांतरण लोकली चलाकर, और नतीजा बताकर। आप अपने पसंदीदा AI ऐप में रहते हैं; EncodeX पर्दे के पीछे भारी काम करता है।

कुछ चीज़ें जो यह खोल देता है:

- **बातचीत के ज़रिए बैच काम** — "इस फ़ोल्डर के हर MKV को MP4 में बदलो और बता देना जब हो जाए।"
- **Agent pipelines** — किसी coding या media agent को बड़े task के हिस्से के रूप में assets तैयार करने दें।
- **दोहराए जाने वाला ऑटोमेशन** — एक workflow एक बार describe करें; आपका असिस्टेंट उसे दोबारा इस्तेमाल करता है।
- **याद रखने के लिए कोई command syntax नहीं** — profiles, codecs और containers आपके लिए संभाले जाते हैं।

---

## कनेक्ट करने के दो तरीके

### 1. स्टैंडअलोन stdio सर्वर

EncodeX को समर्पित MCP प्रोसेस के रूप में चलाएँ। डेस्कटॉप AI ऐप्स यही इस्तेमाल करते हैं जब वे सर्वर को ऑन-डिमांड launch करते हैं:

```bash
# Packaged app
encodex --mcp

# Source checkout (after npm run build:main)
node dist/mcp/index.js
```

stdout पर MCP प्रोटोकॉल चलता है; सारे logs stderr पर जाते हैं, इसलिए आपके असिस्टेंट और EncodeX के बीच की बातचीत में कोई गड़बड़ी नहीं आती।

### 2. Embedded HTTP सर्वर (GUI मोड)

EncodeX पहले से खुला है? **Settings → MCP Server** ऑन करें और अपने client को यहाँ point करें:

```
http://127.0.0.1:8765/mcp
```

यह mode चल रहे ऐप का job queue share करता है और live queue, preview, timeline, system और update tools जोड़ता है — ताकि असिस्टेंट देख सके कि आप किस पर काम कर रहे हैं, बजाय अकेले में काम करने के।

---

## आपका असिस्टेंट क्या कर सकता है

दोनों surfaces पर EncodeX **19 tools** expose करता है।

| Area              | Tools                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| रूपांतरण        | `convert_media`, `batch_convert`, `cut_video`, `compress_image`, `extract_audio`                  |
| निरीक्षण        | `get_media_info`, `list_capabilities`, `list_profiles`, `get_profile`, `ping`                      |
| Job प्रबंधन    | `get_job`, `list_jobs`, `cancel_job`                                                               |
| GUI parity (HTTP) | `get_queue_state`, `cancel_all_jobs`, `get_timeline`, `extract_preview`, `get_system_info`, `check_for_updates` |

इसके अलावा **3 resources** हैं — `encodex://profiles`, `encodex://capabilities`, और `encodex://codecs` — ताकि असिस्टेंट जान सके कि आपका build वास्तव में क्या support करता है, और सबसे आम कार्यों के लिए **4 prompt templates**: convert video, extract audio, compress image और batch convert।

रूपांतरण **asynchronous** हैं। लंबा render बातचीत को freeze नहीं करता: आपका असिस्टेंट job शुरू करता है, job ID पाता है, और बाद में progress poll कर सकता है या उसे cancel कर सकता है।

---

## एक मिनट में सेटअप

### Claude Desktop

Claude Desktop की MCP servers कॉन्फ़िगरेशन में EncodeX जोड़ें:

```json
{
  "mcpServers": {
    "encodex": {
      "command": "encodex",
      "args": ["--mcp"]
    }
  }
}
```

Claude Desktop को restart करें और पूछें: *"EncodeX से ~/Videos/clip.mov को MP4 में बदलो।"*

### Cursor / VS Code

वही server definition अपनी MCP कॉन्फ़िगरेशन में जोड़ें (Cursor में `mcp.json`, या VS Code की MCP settings), `command` को `--mcp` argument के साथ `encodex` पर point करके। Embedded सर्वर के लिए, ऊपर दिखाया गया HTTP transport URL इस्तेमाल करें।

### कोई भी MCP client

stdio सर्वर एक मानक JSON-RPC प्रोसेस है — कोई विशेष integration ज़रूरी नहीं। अगर आपका टूल command spawn कर सकता है और MCP बोल सकता है, तो वह EncodeX से बात कर सकता है।

---

## डिज़ाइन से प्राइवेट और सुरक्षित

Automation surface ship करने का मतलब है सुरक्षा को गंभीरता से लेना। Embedded सर्वर जानबूझकर conservative है:

- **सिर्फ़ loopback** — यह `127.0.0.1` से binds होता है और कभी दूसरी machine से नहीं पहुँचा जा सकता।
- **Origin checks** — cross-origin requests अस्वीकार होती हैं, जब तक वे local ऐप से नहीं आतीं।
- **Optional bearer token** — इसे enable करें और हर request authenticate होना चाहिए, constant-time comparison के साथ।
- **Minimal HTTP surface** — `/mcp` पर केवल `GET`, `POST` और `DELETE`।
- **Clean shutdown** — सर्वर stop होने या ऐप बंद होने पर सभी sessions force-close होते हैं।
- **कोई file exfiltration नहीं** — सर्वर GUI जैसा ही local FFmpeg engine चलाता है। कुछ भी अपलोड नहीं होता।

स्टैंडअलोन `--mcp` mode वही "सब कुछ लोकली चलता है" की गारंटी देता है: यह आपकी machine पर पहले से मौजूद engine से बात करने का बस एक और तरीका है।

---

## यह किसके लिए है?

- **क्रिएटर्स और एडिटर्स** जो पहले से किसी AI असिस्टेंट के अंदर काम करते हैं और उसे छोड़े बिना assets तैयार करवाना चाहते हैं।
- **डेवलपर्स** जो agent workflows बना रहे हैं जिन्हें असली media processing चाहिए।
- **ऑटोमेशन के शौक़ीन** जो one-off commands की बजाय repeatable, describable pipelines चाहते हैं।
- **कोई भी** जो सेटिंग ढूँढने से बेहतर नतीजा माँगना पसंद करता है।

अगर आपने कभी MCP client इस्तेमाल नहीं किया, तो कुछ नहीं बदलता — GUI और CLI बिल्कुल वैसे ही हैं। MCP सर्वर उसी engine में एक अतिरिक्त प्रवेश द्वार है।

---

## आज ही आज़माएँ

1. नवीनतम EncodeX build में अपडेट करें।
2. `encodex --mcp` चलाएँ, या ऐप में **Settings → MCP Server** enable करें।
3. अपने AI असिस्टेंट को कनेक्ट करें और उसे कुछ कन्वर्ट करने के लिए कहें।

पूरा रेफ़रेंस — हर tool, resource, prompt, client config और security model — [MCP दस्तावेज़](/docs/cli#mcp-server-mode) में पढ़ें।

---

[EncodeX डाउनलोड करें](/download) · [सभी फ़ीचर्स देखें](/features) · [CLI दस्तावेज़ पढ़ें](/docs/cli)