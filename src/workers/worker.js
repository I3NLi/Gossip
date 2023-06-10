const { parentPort, workerData } = require('worker_threads');

// 根据传入数据的前四位生成不同的函数处理数据
function processRequest(data) {
  const prefix = data.slice(0, 4);

  switch (prefix) {
    case 'FUNC':
      return processDataFunc(data);
    case 'CALC':
      return processDataCalc(data);
    case 'TRANS':
      return processDataTrans(data);
    default:
      return 'Unknown request';
  }
}

// 处理以 FUNC 开头的请求
function processDataFunc(data) {
  // 实现 FUNC 相关的处理逻辑
  return `Processed FUNC request: ${data}`;
}

// 处理以 CALC 开头的请求
function processDataCalc(data) {
  // 实现 CALC 相关的处理逻辑
  return `Processed CALC request: ${data}`;
}

// 处理以 TRANS 开头的请求
function processDataTrans(data) {
  // 实现 TRANS 相关的处理逻辑
  return `Processed TRANS request: ${data}`;
}

// 处理接收到的数据
function processMessage(message) {
  const { address, data } = message;
  const result = processRequest(data);

  // 返回处理结果给主线程
  parentPort.postMessage({ address, result });
}

// 监听主线程发送的消息
parentPort.on('message', processMessage);
