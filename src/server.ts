import 'dotenv/config';

import app from './app.js';
import { EnvironmentConfig } from './config/environment.js';

class ServerBootstrap {
    public constructor(
        private readonly application: typeof app,
        private readonly port: number,
    ) { }

    public start(): void {
        this.application.listen(this.port, () => {
            console.log(`Server running on http://localhost:${this.port}`);
        });
    }
}

const environment = EnvironmentConfig.fromProcessEnv();
const server = new ServerBootstrap(app, environment.port);

server.start();
