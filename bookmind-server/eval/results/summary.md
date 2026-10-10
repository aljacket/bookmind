**Quality** (percent; rubric score is the mean of five checks per answer)

| Candidate | Rec. score | Books found in catalogues | Books that exist (catalogue + manual review) | Real book, wrong title or author | Invented (no such book) | Answers with 3/3 existing | Reasons cite reader | Already-read repeats | Clarifier score | Overall (70/30 x acceptance) |
|---|---|---|---|---|---|---|---|---|---|---|
| openai-gpt-4o-mini | 94.3 | 73.3 | 73.8 | 9.3 | 14.8 | 51.6 | 99.4 | 0.8 | 97.6 | 95.3 |
| openai-gpt-6-luna-noreason | 96.6 | 82.9 | 84.3 | 6.6 | 6.4 | 64.8 | 100.0 | 0.0 | 100.0 | 96.0 |
| openai-gpt-6-luna | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 0.0 | 0.0 |
| openai-gpt-6-sol-noreason | 98.4 | 84.1 | 92.1 | 4.7 | 1.6 | 81.0 | 100.0 | 0.0 | 92.9 | 96.8 |
| or-claude-haiku-5.5-bedrock-eu-noreason | 92.4 | 63.1 | 65.0 | 9.3 | 24.9 | 37.7 | 99.7 | 1.6 | 71.4 | 81.5 |
| or-claude-haiku-5.5-bedrock-eu | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 64.3 | 19.3 |
| or-claude-sonnet-5.5-vertex-eu | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 0.0 | 0.0 |
| or-gemini-3.1-flash-lite-vertex-eu | 94.2 | 71.7 | 72.8 | 8.7 | 13.0 | 50.8 | 99.7 | 0.0 | 100.0 | 95.9 |
| or-gemini-3.8-flash-vertex | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 0.0 | 0.0 |
| or-mistral-large-2512-eu | 95.6 | 78.4 | 78.4 | 5.9 | 14.7 | 58.8 | 100.0 | 0.0 | 57.1 | 17.1 |
| or-mistral-small-2603-eu | 95.2 | 75.6 | 78.2 | 5.5 | 14.7 | 54.8 | 99.3 | 1.0 | 95.2 | 60.3 |
| proxy-gpt-oss-120b-via-openrouter | 94.5 | 71.0 | 73.5 | 8.6 | 17.9 | 50.0 | 100.0 | 0.0 | 71.4 | 65.5 |
| proxy-llama-3.3-70b-via-openrouter | 93.2 | 65.9 | 67.9 | 9.1 | 20.6 | 47.6 | 100.0 | 0.0 | 76.2 | 88.1 |

**JSON reliability of /recommendations** (share of calls the unchanged parser accepted)

| Candidate | Plain (production request) | + response_format on /recommendations only | + response_format on both endpoints | Clarifier checks with response_format on both |
|---|---|---|---|---|
| openai-gpt-4o-mini | 100.0 (42/42) | 100.0 (42/42) | 100.0 (42/42) | 0.0 (0/42) |
| openai-gpt-6-luna-noreason | 97.6 (41/42) | 100.0 (42/42) | 100.0 (42/42) | 0.0 (0/42) |
| openai-gpt-6-luna | 0.0 (0/14) | n/a | n/a | n/a |
| openai-gpt-6-sol-noreason | 100.0 (42/42) | n/a | n/a | n/a |
| or-claude-haiku-5.5-bedrock-eu-noreason | 92.9 (39/42) | 97.6 (41/42) | 100.0 (42/42) | 73.8 (31/42) |
| or-claude-haiku-5.5-bedrock-eu | 0.0 (0/14) | n/a | n/a | n/a |
| or-claude-sonnet-5.5-vertex-eu | 0.0 (0/42) | n/a | n/a | n/a |
| or-gemini-3.1-flash-lite-vertex-eu | 100.0 (42/42) | 100.0 (42/42) | 100.0 (42/42) | 0.0 (0/42) |
| or-gemini-3.8-flash-vertex | 0.0 (0/42) | n/a | n/a | n/a |
| or-mistral-large-2512-eu | 0.0 (0/42) | 81.0 (34/42) | n/a | n/a |
| or-mistral-small-2603-eu | 47.6 (20/42) | 100.0 (42/42) | 100.0 (42/42) | 0.0 (0/42) |
| proxy-gpt-oss-120b-via-openrouter | 66.7 (28/42) | 61.9 (26/42) | n/a | n/a |
| proxy-llama-3.3-70b-via-openrouter | 100.0 (42/42) | 100.0 (42/42) | n/a | n/a |

**Latency** (seconds, HTTP 200 only, measured from the operator's machine)

| Candidate | /recommendations p50 | p95 | max | /clarify p50 | p95 | calls over 30 s |
|---|---|---|---|---|---|---|
| openai-gpt-4o-mini | 1.84 | 2.32 | 3.00 | 1.07 | 1.32 | 0 |
| openai-gpt-6-luna-noreason | 2.52 | 2.92 | 3.45 | 1.42 | 2.50 | 0 |
| openai-gpt-6-luna | n/a | n/a | n/a | n/a | n/a | 0 |
| openai-gpt-6-sol-noreason | 2.95 | 3.36 | 3.83 | 1.39 | 2.74 | 0 |
| or-claude-haiku-5.5-bedrock-eu-noreason | 2.43 | 3.15 | 4.87 | 1.07 | 1.50 | 0 |
| or-claude-haiku-5.5-bedrock-eu | n/a | n/a | n/a | 1.12 | 2.47 | 0 |
| or-claude-sonnet-5.5-vertex-eu | n/a | n/a | n/a | n/a | n/a | 0 |
| or-gemini-3.1-flash-lite-vertex-eu | 1.39 | 1.64 | 2.50 | 0.85 | 1.14 | 0 |
| or-gemini-3.8-flash-vertex | n/a | n/a | n/a | n/a | n/a | 0 |
| or-mistral-large-2512-eu | n/a | n/a | n/a | 1.00 | 1.65 | 0 |
| or-mistral-small-2603-eu | 1.77 | 2.78 | 6.39 | 0.65 | 2.47 | 0 |
| proxy-gpt-oss-120b-via-openrouter | 8.99 | 13.72 | 19.08 | 2.93 | 5.07 | 0 |
| proxy-llama-3.3-70b-via-openrouter | 13.38 | 47.04 | 60.20 | 1.55 | 5.13 | 6 |

**Cost** (measured tokens x listed price, plus the credit fee where it exists)

| Candidate | Tokens in/out clarify | Tokens in/out recommend | $/chat | $/user/day (5 chats = 10 calls) | $/month (100 DAU) | Spent in this evaluation |
|---|---|---|---|---|---|---|
| openai-gpt-4o-mini | 258 / 24 | 327 / 150 | 0.00019 | 0.0010 | 2.88 | 0.0195 |
| openai-gpt-6-luna-noreason | 257 / 25 | 326 / 186 | 0.00016 | 0.0008 | 2.46 | 0.0175 |
| openai-gpt-6-luna | n/a / n/a | n/a / n/a | 0.00000 | 0.0000 | 0.00 | 0.0000 |
| openai-gpt-6-sol-noreason | 257 / 23 | 326 / 173 | 0.00313 | 0.0156 | 46.94 | 0.1314 |
| or-claude-haiku-5.5-bedrock-eu-noreason | 384 / 53 | 511 / 335 | 0.00033 | 0.0016 | 4.93 | 0.0378 |
| or-claude-haiku-5.5-bedrock-eu | 385 / 57 | 512 / 400 | 0.00037 | 0.0018 | 5.54 | 0.0052 |
| or-claude-sonnet-5.5-vertex-eu | n/a / n/a | n/a / n/a | 0.00000 | 0.0000 | 0.00 | 0.0000 |
| or-gemini-3.1-flash-lite-vertex-eu | 255 / 28 | 322 / 161 | 0.00050 | 0.0025 | 7.45 | 0.0658 |
| or-gemini-3.8-flash-vertex | n/a / n/a | n/a / n/a | 0.00000 | 0.0000 | 0.00 | 0.0000 |
| or-mistral-large-2512-eu | 261 / 25 | 335 / 213 | 0.00076 | 0.0038 | 11.40 | 0.0372 |
| or-mistral-small-2603-eu | 270 / 24 | 344 / 165 | 0.00024 | 0.0012 | 3.58 | 0.0282 |
| proxy-gpt-oss-120b-via-openrouter | 308 / 66 | 377 / 296 | 0.00009 | 0.0005 | 1.37 | 0.0057 |
| proxy-llama-3.3-70b-via-openrouter | 272 / 18 | 343 / 217 | 0.00014 | 0.0007 | 2.17 | 0.0105 |
