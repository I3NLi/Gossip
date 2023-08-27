// 引入 args 和 ini 库
const args = require('args');
const fs = require('fs');
const ini = require('ini');

// 定义命令行选项
args.option('c', 'Path to the configuration file');

// 解析命令行参数
const flags = args.parse(process.argv);
const configFile = flags.c;

// 读取和解析配置文件
const configData = fs.readFileSync(configFile, 'utf-8');
const config = ini.parse(configData);

