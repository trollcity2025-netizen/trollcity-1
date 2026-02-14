import express from 'express';
import cors from 'cors';
import { AccessToken } from 'livekit-server-sdk';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

app.post('/api/livekit-token', (req, res) => {
  const { roomName, identity, _role, allowPublish } = req.body;

  if (req.headers['x-load-test-secret'] !== 'your-secret-load-test-key') {
    return res.status(403).send('Forbidden');
  }

  const at = new AccessToken('APIab3e5023a52a49', '5a32a2e69736e391a3e3a3e3a3e3a3e3', {
    identity: identity,
  });

  at.addGrant({ room: roomName, roomJoin: true, canPublish: allowPublish });
  res.json({ token: at.toJwt() });
});

app.listen(port, () => {
  console.log(`API server listening at http://localhost:${port}`);
});
