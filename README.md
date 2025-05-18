# Odoo 18 Docker 部署与开发指南

## 项目简介
本项目用于基于 Docker 快速部署 Odoo 18，并支持自定义插件开发。适合开发、测试和生产环境。

## 目录结构
- `docker-compose.yaml`：Docker 服务编排文件
- `_config/`：实际使用的 Odoo 配置文件目录（可参考 `_config_example/`）
- `_config_example/`：配置文件模板
- `requirements.txt`：Python 依赖（如数据库驱动）
- `odoo18_addons/`：自定义 Odoo 插件目录（本目录）
- 其他子目录：各类 Odoo 插件模块

## 依赖安装
如需在本地开发环境运行 Odoo，请先安装 Python 依赖：

```bash
pip install -r requirements.txt
```

## 快速开始

1. 参考 `docker-compose.yaml` 文件

2. 启动服务：

```bash
docker-compose up -d
```

3. 克隆 Odoo 18.0 源码（可选）：

```bash
git clone --single-branch --branch 18.0 https://github.com/odoo/odoo.git odoo-18-github --depth 1
```

上述命令解释：
- `git clone`：克隆远程仓库到本地。
- `--single-branch`：只克隆指定分支（而不是所有分支）。
- `--branch 18.0`：指定克隆的分支为 18.0。
- `https://github.com/odoo/odoo.git`：Odoo 官方 GitHub 仓库地址。
- `odoo-18-github`：本地保存的文件夹名称。
- `--depth 1`：只克隆最近一次提交（浅克隆），加快下载速度并减少空间占用。

4. 访问 Odoo：

浏览器打开 http://localhost:8069

## 配置文件说明

- 推荐将 `_config_example/odoo.conf` 复制到 `_config/odoo.conf`，并根据实际需求调整。
- 主要参数说明：
  - `db_host`、`db_port`、`db_user`、`db_password`：数据库连接信息
  - `addons_path`：插件目录，默认 `/mnt/extra-addons`
  - `logfile`：日志文件路径
  - `admin_passwd`：Odoo 管理员密码
  - `xmlrpc_port`、`longpolling_port`：服务端口


## 参考链接
- [Odoo 官方文档](https://www.odoo.com/documentation/18.0/zh_CN/)
- [Odoo Docker 镜像](https://hub.docker.com/_/odoo)
- [Odoo 源码仓库](https://github.com/odoo/odoo)

