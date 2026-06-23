The Arduino UNO Q is an unusual board: it pairs an MCU running classic C++ sketches with a CPU running Linux for Python applications, and the two communicate with each other over an internal bridge. This dual architecture means setup is more involved than a typical Arduino board. The Linux side also comes ready for AI workloads out of the box, which is what makes the on-device person detection in this project possible without any separate inference hardware.

<p align="center">
  <img src="../Assets/Arduino_UNO_Q.webp" width="600">
</p>

## Python application

The person detection app is based on Arduino's built-in "Detect Objects on Camera" example. 
That example sets up a `VideoObjectDetection` stream and a `WebUI`, then streams every detection (label, confidence, timestamp) to the browser as JSON over a Socket.IO message. 

This project builds on that scaffold: the confidence threshold is raised to ensure a certain detection accuracy.

See root README to better understand the SW.

## Deployment and usage: UNO Q development in VS Code

The UNO Q's Linux side is managed over SSH rather than through a USB serial connection, so most of the day-to-day workflow happens from a terminal once the board is on your network. One can also use Arduino App Lab as a development environment option. However. I encountered many bugs and lacks of ergonomy. The software is still under development and may be a preferred option in the future. Hence, I highly recommend another IDE for the Arduino UNO Q.

### Connecting

Find the board's IP address under AppLab => Bottom of page, then connect over SSH:

```bash
ssh arduino@<UNO_Q_IP_ADDRESS>
```

To work in VS Code directly against the board's filesystem, use the Remote-SSH extension: `Ctrl+Shift+P` => **Remote-SSH: Open SSH Configuration File...** => select your `~/.ssh/config` => add or edit a `HostName` entry with the board's IP address.

```config
Host YOURHOSTNAME
    HostName YOURIPADDRESS
    User arduino (if not changed by you)
```

### Managing apps with `arduino-app-cli`

```bash
# List available apps
arduino-app-cli app list

# Start an app
arduino-app-cli app start ~/apps/YourAppName

# Stop an app
arduino-app-cli app stop ~/apps/YourAppName

# View an app's Python logs
arduino-app-cli app logs ~/apps/YourAppName
```

### Working with Docker directly

Each app runs inside its own Docker container on the Linux side, which is occasionally useful to inspect directly:

```bash
# List all containers, including stopped ones
docker ps -a

# Start a specific container
docker start <container_id>

# Run a Python script inside a running container
docker exec <container_id> python main.py
```

### Python dependencies

To add Python libraries to an app, create a `requirements.txt` file inside that app's `python/` folder. If you change `requirements.txt` after the app has already built once, the cached build may not pick up the change. Clearing the app's cache forces a rebuild:

```bash
rm -rf ~/apps/YourAppName/.cache
```

### Edge Impulse Model Deployment
To add a custom Edge Impulse model, you have two options:

1. **Via App Lab**: link your Edge Impulse account in App Lab. Any model you generate there will automatically become available under the brick folder by clicking the "AI models" option.
2. **Via VS Code**: download the `model.eim` and `model.yaml` files from your Edge Impulse project, place them under `home/arduino/.arduino-brick/models/custom-ei`, then update your `app.yaml` file with the correct model ID. See this project's files for a working example.

### Troubleshooting

- Keep `app.yaml` and `sketch.yaml` in sync with what the app actually needs: `app.yaml` declares the Bricks (web UI, video classification, etc.) the Python side uses, and `sketch.yaml` declares the libraries the MCU sketch needs. A mismatch here is a common source of an app that builds but doesn't run correctly.

- If you require to modify a brick code please find the code [here](https://github.com/arduino/app-bricks-py) and paste the code as is done in this project before importing your modified brick.
