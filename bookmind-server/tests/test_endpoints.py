"""For a signed-in user under the limit, requests and responses are what they were before."""

import json

from prompts import (
    CLARIFIER_SYSTEM_PROMPT,
    RECOMMENDATION_SYSTEM_PROMPT,
    build_clarifier_prompt,
    build_recommendation_prompt,
)
from tests.conftest import CLARIFY_BODY, RECOMMEND_BODY, bearer


def test_clarify_response_and_provider_request_are_unchanged(client, fake_llm):
    response = client.post("/recommendations/clarify", json=CLARIFY_BODY, headers=bearer())
    assert response.status_code == 200
    assert response.json() == {"question": "Do you want a short read?"}

    assert fake_llm.calls == [
        {
            "messages": [
                {"role": "system", "content": CLARIFIER_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": build_clarifier_prompt(
                        "en", ["I want something hopeful", "Loved Sapiens"]
                    ),
                },
            ],
            "temperature": 0.3,
            "max_tokens": 80,
        }
    ]


def test_recommendations_response_and_provider_request_are_unchanged(client, fake_llm):
    response = client.post("/recommendations", json=RECOMMEND_BODY, headers=bearer())
    assert response.status_code == 200
    assert response.json() == [
        {"title": "Title A", "author": "Author A", "reason": "Because you said hopeful"}
    ]

    assert fake_llm.calls == [
        {
            "messages": [
                {"role": "system", "content": RECOMMENDATION_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": build_recommendation_prompt(
                        "en",
                        ["I want something hopeful", "Loved Sapiens", "Something short"],
                        liked_books=[{"title": "Sapiens", "author": "Yuval Noah Harari"}],
                    ),
                },
            ],
            "temperature": 0.7,
            "max_tokens": 400,
        }
    ]


def test_recommendations_without_liked_books(client, fake_llm):
    body = {k: v for k, v in RECOMMEND_BODY.items() if k != "liked_books"}
    response = client.post("/recommendations", json=body, headers=bearer())
    assert response.status_code == 200


def test_empty_clarifier_reply_is_502(client, fake_llm):
    fake_llm.clarify_reply = ""
    response = client.post("/recommendations/clarify", json=CLARIFY_BODY, headers=bearer())
    assert response.status_code == 502


def test_unparsable_recommendation_reply_is_502(client, fake_llm):
    fake_llm.recommend_reply = "not json"
    response = client.post("/recommendations", json=RECOMMEND_BODY, headers=bearer())
    assert response.status_code == 502


def test_recommendation_reply_without_valid_items_is_502(client, fake_llm):
    fake_llm.recommend_reply = json.dumps({"b": [{"t": "Only a title"}]})
    response = client.post("/recommendations", json=RECOMMEND_BODY, headers=bearer())
    assert response.status_code == 502


def test_validation_errors_are_still_422(client):
    response = client.post(
        "/recommendations/clarify",
        json={"lang": "fr", "transcript": CLARIFY_BODY["transcript"]},
        headers=bearer(),
    )
    assert response.status_code == 422
