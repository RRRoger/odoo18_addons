# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request
import requests
import json
import logging

_logger = logging.getLogger(__name__)

class MyController(http.Controller):

    @http.route('/my_module/hello', auth='public', type='http', methods=['GET'], csrf=False)
    def hello(self, **kwargs):
        return "Hello, Odoo Controller!"

    @http.route('/my_module/json', auth='public', type='json', methods=['POST'], csrf=False)
    def json_endpoint(self, **kwargs):
        return {'message': 'This is a JSON response from Odoo controller.'}

    @http.route('/llm_tools/ask_llm', auth='public', type='json', methods=['POST'], csrf=False)
    def ask_llm(self, **kwargs):
        """
        接收query参数，调用通义千问大模型并返回结果。
        """

        _logger.info(f"request.httprequest: {request.httprequest}")
        _logger.info(f"request.httprequest.data: {request.httprequest.data}")
        data = json.loads(request.httprequest.data)

        query = data.get('query')
        if not query:
            return {'error': 'Missing query parameter'}
        # 获取激活的API Key
        llm = request.env['llm.tools'].sudo().search([('is_active', '=', True)], limit=1)
        if not llm or not llm.api_key:
            return {'error': 'No active LLM API key configured'}
        # 调用模型方法
        result = llm.call_qianwen(query)
        return {'result': result}
        

    