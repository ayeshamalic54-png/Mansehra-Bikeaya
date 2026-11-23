import os
import sys
import webbrowser
import webview

APP_URL = os.environ.get("BIKEAYA_APP_URL", "https://mansehra-bikeaya.onrender.com")
APP_TITLE = "Mansehra Bikeaya — Dispatch & Rider Network"


class DesktopApi:
    def open_external(self, url: str) -> None:
        if url:
            webbrowser.open(url)


def main() -> None:
    api = DesktopApi()
    window = webview.create_window(
        title=APP_TITLE,
        url=APP_URL,
        width=1280,
        height=820,
        min_size=(400, 680),
        resizable=True,
        js_api=api,
        text_select=True,
    )
    webview.start(gui="edgechromium")


if __name__ == "__main__":
    main()
