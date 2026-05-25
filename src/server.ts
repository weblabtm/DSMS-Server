import 'dotenv/config';

import app from './app.js';
import { environment } from './config/environment.js';

const port = environment.port;

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
