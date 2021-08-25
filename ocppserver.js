const WebSocket = require("ws");

const PORT = 3002;
const OCPP_PROTOCOL_1_6 = "ocpp1.6";
const CALL_MESSAGE = 2; // Client-to-Server
const CALLRESULT_MESSAGE = 3; // Server-to-Client
const CALLERROR_MESSAGE = 4; // Server-to-Client

const BOOT_NOTIFICATION = 'BootNotification';
const STATUS_NOTIFICATION = 'StatusNotification';

const wsOption = {
  port: PORT,
  handleProtocols: (protocols, req) => {
    if (!protocols.has(OCPP_PROTOCOL_1_6)) return [""];

    return [OCPP_PROTOCOL_1_6];
  },
  verifyClient: (info, callback) => {
    const clientId = info.req.url.split("/")[1];

    if (clientId == null || clientId == undefined || clientId == "undefined") {
      console.log("Invalid clientid, returning 404");
      return callback(false, 404, "Invalid clientid");
    }

    return callback(true);
  },
};

/**
 * initServer
 * This function is to initialize WebSocket server and bind
 * all the necessory events
 */
const initServer = () => {
  const server = new WebSocket.Server(wsOption, () => {
    console.info("Server is listening on port", PORT);
  });

  server.on("error", (ws, req) => {
    console.error(ws, req);
  });

  server.on("connection", (socket, req) => {
    socket.on("error", (err) => {
      console.error(err, socket.readyState);
    });

    socket.on("message", (msg) => {
      onMessage(msg, socket);
    });

    socket.on("close", (err) => {
      console.info("connection closed");
    });
  });
};

/**
 * onMessage
 * This function will handle all the incoming messages from Charge Point
 * @param {String} message Payload
 * @param {Server} socket Webserver object
 */
const onMessage = (message, socket) => {
  let msgType, msgId, action, payload;

  try {
    [msgType, msgId, action, payload] = JSON.parse(message);
  } catch (err) {
    console.error(`Failed to parse message: "${message}", ${err}`);
  }

  if (msgType == CALL_MESSAGE) {
    switch (action) {
      case BOOT_NOTIFICATION:
        sendMessage(
          CALLRESULT_MESSAGE,
          msgId,
          action,
          { status: "Accepted", currentTime: new Date(), interval: 300 },
          socket
        );
        break;
      case STATUS_NOTIFICATION:
        sendMessage(
          CALLRESULT_MESSAGE,
          msgId,
          action,
          { status: "Accepted", currentTime: new Date(), heartbeatInterval: 300 },
          socket
        );
        break;
      default:
        sendMessage(
          CALLERROR_MESSAGE,
          msgId,
          action,
          { status: "Rejected", currentTime: new Date(), heartbeatInterval: 300 },
          socket
        );
        break;
    }
  }
};

/**
 * sendMessage
 * This function takes care of sending message to the Charge Point
 * @param {Number} msgType Message type code
 * @param {String} msgId Unique message id
 * @param {String} command Action name
 * @param {json} payload Json object
 * @param {Server} socket Webserver
 */
const sendMessage = (msgType, msgId, command, payload, socket) => {
  let msgtoSend = JSON.stringify([msgType, msgId, command, payload]);

  if (socket.readyState === WebSocket.OPEN) {
    socket.send(msgtoSend);
  } else {
    console.log("Socket not ready, returning without sending");
  }
};

initServer();
