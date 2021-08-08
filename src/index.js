import React from "react";
import ReactDOM from "react-dom";
import * as tf from '@tensorflow/tfjs';
import {loadGraphModel} from '@tensorflow/tfjs-converter';
import { Loader } from '@googlemaps/js-api-loader';
import "./styles.css";
tf.setBackend('webgl');

const threshold = 0.75;
let google = null
let map;

const loader = new Loader({
  apiKey: "AIzaSyDPNSEETgYQy4Tnrg4DHT3RYZSxItjMmcg",
  version: "weekly",
  libraries: ["places"]
});

const mapOptions = {
  center: {
    lat: -34.397,
    lng: 150.644
  },
  zoom: 8
};

function initMap() {
  loader.load()
  .then((_google) => {
    google = _google
    map = new google.maps.Map(document.getElementById("map"), mapOptions);
  })
  .catch(e => {
    // do something
  })
}

async function load_model() {
    // It's possible to load the model locally or from a repo
    // You can choose whatever IP and PORT you want in the "http://127.0.0.1:8080/model.json" just set it before in your https server
    //const model = await loadGraphModel("http://127.0.0.1:8080/model.json");
    const model = await loadGraphModel("https://raw.githubusercontent.com/Tbeck-91/road_model/master/web_model/model.json");
    console.log(model)
    return model;
  }

let classesDir = {
    1: {
        name: 'Kangaroo',
        id: 1,
    },
    2: {
        name: 'Other',
        id: 2,
    }
}

class App extends React.Component {
  canvasRef = React.createRef();
  imgRef = React.createRef()


  componentDidMount() {
    initMap() 
    const modelPromise = load_model();

    modelPromise
    .then(model => {
      google.maps.event.addListener(map,"dragend", () => {
        let mapImg = new Image()      
        console.log('dragged!') 
        mapImg.crossOrigin = 'anonymous'  
        mapImg.onload =  () => {
          this.imgRef.current = mapImg
          requestAnimationFrame(() => {
            this.detectFrame(mapImg, model);
          })
        }
        mapImg.onerror= () => {
          console.log("error!")
        }   
        mapImg.src = this.getImageUrl()  
      })
    })
    .catch(error => {
      console.error(error);
    })      
  }

  getImageUrl = () => {
    const mapImgUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${map.getCenter().lat()},${map.getCenter().lng()}&zoom=${map.getZoom()}&size=500x500&maptype=satellite&format=jpg&key=AIzaSyDPNSEETgYQy4Tnrg4DHT3RYZSxItjMmcg`
    return mapImgUrl
  }

  detectFrame = (mapImg, model) => {
      console.log(mapImg.complete)
      if (mapImg.complete) {
        tf.engine().startScope();
        model.executeAsync(this.process_input(mapImg)).then(predictions => {
          console.log(predictions)
          this.renderPredictions(predictions, mapImg);
          tf.engine().endScope();
        });
      }     
  };

  process_input(mapImg){
    const tfimg = tf.browser.fromPixels(mapImg).toInt();
    // see if we need this
    const expandedimg = tfimg.transpose([0,1,2]).expandDims();
    return expandedimg;
  };

  buildDetectedObjects(scores, threshold, boxes, classes, classesDir) {
    const detectionObjects = []
    console.log(scores)
    console.log(this.imgRef.current)
    scores[0].forEach((score, i) => {
      if (score > threshold) {
        const bbox = [];
        const minY = boxes[0][i][0] * this.imgRef.current.offsetHeight;
        const minX = boxes[0][i][1] * this.imgRef.current.offsetWidth
        const maxY = boxes[0][i][2] * this.imgRef.current.offsetHeight;
        const maxX = boxes[0][i][3] * this.imgRef.current.offsetWidth;
        bbox[0] = minX;
        bbox[1] = minY;
        bbox[2] = maxX - minX;
        bbox[3] = maxY - minY;
        detectionObjects.push({
          class: classes[i],
          label: classesDir[classes[i]].name,
          score: score.toFixed(4),
          bbox: bbox
        })
      }
    })
    return detectionObjects
  }

  renderPredictions = predictions => {  
    const ctx = this.canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Font options.
    const font = "16px sans-serif";
    ctx.font = font;
    ctx.textBaseline = "top";

    //Getting predictions
    const boxes = predictions[4].arraySync();
    const scores = predictions[5].arraySync();
    const classes = predictions[6].dataSync();
    const detections = this.buildDetectedObjects(scores, threshold,
                                    boxes, classes, classesDir);

    detections.forEach(item => {
      const x = item['bbox'][0];
      const y = item['bbox'][1];
      const width = item['bbox'][2];
      const height = item['bbox'][3];

      // Draw the bounding box.
      ctx.strokeStyle = "#00FFFF";
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, width, height);

      // Draw the label background.
      ctx.fillStyle = "#00FFFF";
      const textWidth = ctx.measureText(item["label"] + " " + (100 * item["score"]).toFixed(2) + "%").width;
      const textHeight = parseInt(font, 10); // base 10
      ctx.fillRect(x, y, textWidth + 4, textHeight + 4);
    });

    detections.forEach(item => {
      const x = item['bbox'][0];
      const y = item['bbox'][1];

      // Draw the text last to ensure it's on top.
      ctx.fillStyle = "#000000";
      ctx.fillText(item["label"] + " " + (100*item["score"]).toFixed(2) + "%", x, y);
    });
  };

  render() {
    return (
      <div>
        <h1>Real-Time Object Detection: Kangaroo</h1>
        <h3>MobileNetV2</h3>
        <canvas
          className="size"
          ref={this.canvasRef}
          width="500"
          height="500"
        />
      </div>
    );
  }
}

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);
