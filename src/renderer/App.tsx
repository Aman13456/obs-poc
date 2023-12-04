import { useEffect, useRef, useState } from 'react';
import OBSWebSocket, { EventSubscription } from 'obs-websocket-js';
import './App.css';


const obs = new OBSWebSocket();

const connectToObs = async (cs: string) => {
  await obs.connect(cs, undefined, {
    eventSubscriptions:
      EventSubscription.All | EventSubscription.InputVolumeMeters,
    rpcVersion: 1,
  });
};

const disconnectFromObs = async () => {
  await obs.disconnect();
};

function AudioChecker() {
  const [inputVol, setInputVol] = useState([]);
  useEffect(() => {
    obs.on('InputVolumeMeters', (data: any) => {
      setInputVol(data?.inputs?.[1]?.inputLevelsMul?.[0]);
    });
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div
        style={{
          height: 10,
          background: 'red',
          width: (inputVol[0] || 0) * 1000,
        }}
      ></div>
      <div
        style={{
          height: 10,
          background: 'green',
          width: (inputVol[1] || 0) * 1000,
        }}
      ></div>
    </div>
  );
}

function VideoChecker() {
  const [imageData, setImageData] = useState<any>(null);
  const [currentScene, setCurrentScene] = useState<any>();
  const imageIntervalId = useRef<any>(null);

  useEffect(() => {
    obs.call('GetCurrentProgramScene').then((data) => {
      if (data?.currentProgramSceneName) {
        setCurrentScene(data?.currentProgramSceneName);
      }
    });
    obs.on('CurrentProgramSceneChanged', (data) => {
      if (data?.sceneName) {
        setCurrentScene(data.sceneName);
      }
    });
    return () => {
      if (imageIntervalId.current) {
        clearInterval(imageIntervalId.current);
        imageIntervalId.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (currentScene) {
      imageIntervalId.current = setInterval(() => {
        obs
          .call('GetSourceScreenshot', {
            sourceName: currentScene,
            imageFormat: 'jpg',
            imageWidth: 960,
            imageHeight: 540,
          })
          .then((data) => {
            setImageData(data?.imageData);
          });
      }, 200);
    }
    return () => {
      if (imageIntervalId.current) {
        clearInterval(imageIntervalId.current);
        imageIntervalId.current = null;
      }
    };
  }, [currentScene]);

  return imageData ? <img src={imageData} /> : null;
}

function Button({ children, ...rest }: any) {
  return (
    <button
      {...rest}
      className={`border rounded-lg px-4 py-2 ${
        rest.disabled ? 'opacity-50' : ''
      }`}
    >
      {children}
    </button>
  );
}

export default function App() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [connected, setConnected] = useState(false);
  const [startStreaming, setStartStreaming] = useState(false);
  const [stopStreaming, setStopStreaming] = useState(false);
  const [enabledCheckers, setEnabledCheckers] = useState({
    audio: false,
    video: false,
  });

  useEffect(() => {
    obs.on('Identified', async () => {
      setConnected(true);
    });

    obs.on('ConnectionClosed', async () => {
      setEnabledCheckers({
        audio: false,
        video: false,
      });
      setConnected(false);
    });
    return () => {
      disconnectFromObs();
    };
  }, []);

  const onDownload = ()=>{
    window.electron.ipcRenderer.sendMessage(('download-url' as any), "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf");
  }

  return (
    <div className="flex flex-col p-8 gap-4 items-center">
      <input
        className="rounded-lg self-stretch border p-4"
        type="text"
        ref={inputRef}
        placeholder="Enter OBS WebSocket Server address"
      />
      <div className="flex gap-2 justify-center flex-wrap items-center">
      <Button
          onClick={() => {
            onDownload();
          }}
        >
          Download PDF
        </Button>
        <Button
          disabled={connected}
          onClick={() => {
            if (inputRef.current) {
              connectToObs(inputRef.current.value).catch((err) => {
                console.log('unable to connect: ', err);
              });
            }
          }}
        >
          Connect
        </Button>
        <Button
          disabled={!connected}
          onClick={() => {
            disconnectFromObs();
          }}
        >
          Disconnect
        </Button>
        <Button
          disabled={!connected}
          onClick={() => {
            setEnabledCheckers({
              video: !enabledCheckers.video,
              audio: enabledCheckers.audio,
            });
          }}
        >
          Toggle Video Preview
        </Button>
        <Button
          disabled={!connected}
          onClick={() => {
            setEnabledCheckers({
              video: enabledCheckers.video,
              audio: !enabledCheckers.audio,
            });
          }}
        >
          Toggle Audio Preview
        </Button>

        <Button
          disabled={!connected}
          onClick={() => {
            obs
          .call('SetStreamServiceSettings', {
            streamServiceType: 'rtmp_custom',
            streamServiceSettings:{
              server: "rtmp://65.2.88.0:1935/live/2023-09-14-07-23-39",
              key:"2023-09-14-07-23-39"
            }
          }).then((res)=>{
            console.log('response in here', res);
            setStartStreaming(true);
          })
         
          }}
        >
          SET STREAM SETTINGS
        </Button>

        {startStreaming && <Button
          disabled={!connected}
          onClick={() => {
            obs
          .call('StartStream').then((res)=>{

            console.log('response in here start streaming', res);
            setStopStreaming(true);
            setStartStreaming(false);
          })
         
          }}
        >
          Start Streaming
        </Button>}
        {stopStreaming && <Button
          disabled={!connected}
          onClick={() => {
            obs
          .call('StopStream').then((res)=>{

            console.log('response in here stop streaming', res);
            setStopStreaming(false);
            setStartStreaming(true);
          })
         
          }}
        >
          Stop Streaming
        </Button>}
        <Button
          onClick={() => {
            window.electron.ipcRenderer.sendMessage(('shell-url' as any), "file://Users/rishabhjain/Downloads/dummy.pdf");
 
            console.log('/Users/rishabhjain/Downloads/dummy.pdf')
            // shell.openPath('/Users/rishabhjain/Downloads/dummy.pdf');
          }}
        >
          Open Third Party App
        </Button>
      </div>
      {enabledCheckers.video && <VideoChecker />}
      {enabledCheckers.audio && <AudioChecker />}
    </div>
  );
}
