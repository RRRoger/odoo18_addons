from odoo import models, fields

class LLMIntegration(models.Model):
    _name = 'llm.tools'
    _description = 'LLM集成工具'

    name = fields.Char(string='名称', required=True)
    api_key = fields.Char(string='API密钥')
    is_active = fields.Boolean(string='是否激活', default=True)
    last_used = fields.Datetime(string='最后使用时间')

    def test_connection(self):
        # 这里添加测试连接的逻辑
        return True
