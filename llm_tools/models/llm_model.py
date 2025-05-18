from odoo import models, fields
import requests
import json

class LLMIntegration(models.Model):
    _name = 'llm.tools'
    _description = 'LLM集成工具'

    name = fields.Char(string='名称', required=True)
    api_key = fields.Char(string='API密钥')
    is_active = fields.Boolean(string='是否激活', default=True)
    last_used = fields.Datetime(string='最后使用时间')

    def testing(self):
        self.env.user.notify_success(message='My success message')
        self.with_delay().call_qianwen('你好')
        return True

    def call_qianwen(self, query, api_key=None):
        """
        调用通义千问大模型API，返回结果。
        :param query: 用户输入的查询内容
        :param api_key: 可选，API密钥，未传则用当前记录的api_key
        :return: 返回模型输出或错误信息
        """

        api_key = api_key or self.api_key
        if not api_key:
            return 'No API key provided.'
        url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        payload = {
            "model": "qwen-long",
            "input": {
                "prompt": query
            }
        }
        try:
            resp = requests.post(url, headers=headers, data=json.dumps(payload), timeout=30)
            if resp.status_code == 200:
                data = resp.json()
                return data.get('output', {}).get('text', data)
            else:
                return f"Qianwen API error: {resp.status_code} {resp.text}"
        except Exception as e:
            return f"Qianwen API exception: {str(e)}"
