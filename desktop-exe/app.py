import os
import webbrowser
import webview

APP_URL = os.environ.get("SAFARGO_APP_URL") or os.environ.get("BIKEAYA_APP_URL", "https://safargoride.onrender.com")
APP_TITLE = "SafarGo — Rides, Cars, Parcels & Dispatch"


class DesktopApi:
    def open_external(self, url: str) -> None:
        if url:
            webbrowser.open(url)


def main() -> None:
    api = DesktopApi()
    webview.create_window(
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
