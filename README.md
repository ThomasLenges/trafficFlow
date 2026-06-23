# Traffic Flow Estimation

A real-time traffic flow tracker that bridges an Arduino UNO Q with a USB camera to a live web dashboard. It detects vehicles (cars, buses, and trucks excluding bicycles and motorcycles), tracks them and their direction, and streams traffic flow data to a live dashboard for visualizing pipeline results and getting first insights from the data.

All running from a browser via Socket.IO on the local network.

https://github.com/user-attachments/assets/e6233895-3bfb-4539-87b5-fe647224761f

**[Live dashboard](https://thomaslenges.github.io/trafficFlow/)** hosted via GitHub Pages. This hosted demo shows the dashboard UI only since it isn't connected to any running hardware, no local data is present (which is why the graph appears empty).

Deploy the project yourself to try out the model and tune the key parameters explained later in this README!

## Hardware

<p align="center">
  <img src="Assets/hardware.jpeg" height="600">
</p>

Project hardware:

-  [**Arduino UNO Q**](https://store.arduino.cc/pages/uno-q?utm_source=google&utm_medium=cpc&utm_campaign=EU-UNO-Q&gad_source=1&gad_campaignid=23081042134&gbraid=0AAAAACbEa852hSoIGIYWjmJBsA_YCgtWe&gclid=EAIaIQobChMI_KXSqY2QlQMVj5CDBx1UZxhpEAAYASAAEgKkfvD_BwE)
-  [**USB Webcam**](https://www.amazon.fr/-/en/veorkide-Webcam-Full-1080P-30FPS/dp/B0G7C4VPLG)
-  [**Powered USB-C Hub**](https://www.amazon.de/UGREEN-Revodok-Datenports-Multiport-Thinkpad/dp/B0BR3M8XHK)

These links are meant to specify the exact part used, not to endorse a particular retailer. Feel free to source equivalents elsewhere.

## Software

### Detection

### Tracking

### Dashboard

#### Connection Status
The dashboard opens a Socket.IO connection to the Arduino UNO Q and reflects its state in real time. A status dot turns green when connected and red when disconnected, paired with a card showing the timestamp of the last connection change and the last detection received. A running count of detections since the page was last refreshed gives an at-a-glance sense of activity and confirms the pipeline is alive end-to-end from camera to UNO Q to browser.

<p align="center">
  <img src="Assets/dashboard0.png" height="400">
</p>

#### Live Feed & Detection Log
An embedded iframe streams the live annotated video feed such as done by Arduino built-in app [video-generic-object-detection](https://github.com/arduino/app-bricks-examples/tree/main/examples/common/video-generic-object-detection). Below is a detection log lists each vehicle as it's detected along with its average confidence score (updated in real-time). Once a vehicle's direction of travel is determined the corresponding log entry updates with it.

<p align="center">
  <img src="Assets/dashboard1.png" height="400">
</p>

#### Traffic Flow Chart
Detections are aggregated into a bar chart showing flow by direction (right-to-left vs. left-to-right) with hover tooltips. Four filter buttons (5 min / 1 hour / 1 day / 1 week) enable visualizing different time windows. Two color pickers are present to customize the chart's RTL/LTR bar colors to taste. Both color choices and detection history (up to one week) persist locally via `localStorage`. A reset button is available to clear the stored history entirely.

<p align="center">
  <img src="Assets/dashboard2.png" height="400">
</p>

## Deployment
