const express = require('express');
const router = express.Router();
const AgentManager = require('../../config/agentManager');
const { verifyToken } = require('./auth');

const agentManager = new AgentManager();

// API: GET /api/agents
router.get('/', verifyToken, async (req, res) => {
    try {
        const agents = await agentManager.getAllAgents();
        res.json({ success: true, data: agents });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// API: GET /api/agents/:id
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const agent = await agentManager.getAgentById(req.params.id);
        if (!agent) {
            return res.status(404).json({ success: false, message: 'Agent not found' });
        }
        const stats = await agentManager.getAgentStatistics(req.params.id);
        res.json({ success: true, data: { ...agent, stats } });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// API: POST /api/agents/add-balance
router.post('/add-balance', verifyToken, async (req, res) => {
    try {
        const { agentId, amount, notes } = req.body;
        const result = await agentManager.addBalance(agentId, parseInt(amount), notes || 'Saldo ditambahkan via Mobile API');
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = router;
