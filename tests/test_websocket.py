from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from backend.main import app


def test_health_endpoint():
    client = TestClient(app)
    assert client.get("/health").json() == {"status": "ok"}


def test_websocket_sends_connected_on_open():
    client = TestClient(app)
    with client.websocket_connect("/ws") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "connected"


def test_websocket_handles_user_message():
    mock_result = {
        "strudel_code": '$: note("c3")',
        "active_knobs": [],
        "agent_message": "Ciao!",
        "creative_mode": False,
        "musical_context": {},
        "conversation_history": [],
        "user_intent": "chat",
        "next_agents": [],
        "creative_suggestions": [],
    }
    with patch("backend.main.GRAPH") as mock_graph:
        mock_graph.invoke.return_value = mock_result
        client = TestClient(app)
        with client.websocket_connect("/ws") as ws:
            ws.receive_json()  # consume "connected"
            ws.send_json({"type": "user_message", "message": "ciao"})
            response = ws.receive_json()
    assert response["type"] == "update"
    assert response["code"] == '$: note("c3")'
    assert response["message"] == "Ciao!"
