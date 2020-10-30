import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import {Logger} from '@nestjs/common';
import {Server, Socket} from 'socket.io';
import {AtemService} from "../atem/atem.service";

import {Commands} from 'atem-connection';
import {IsAtKeyFrame} from "atem-connection/dist/enums";


@WebSocketGateway()
export class MacrosGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    constructor(private readonly atemService: AtemService) {}

    @WebSocketServer() server: Server;
    private logger: Logger = new Logger('MacrosGateway');

    @SubscribeMessage('macro:create')
    handleMacroCreate(client: Socket, payload: string) {

    }

    @SubscribeMessage('macro:update')
    handleMacroUpdate(client: Socket, payload: string) {

    }

    @SubscribeMessage('macro:delete')
    handleMacroDelete(client: Socket, payload: string) {

    }

    @SubscribeMessage('atem:connect')
    async handleConnectMessage(client: Socket, payload: string) {
        this.logger.log('connect was called');
        const res = await this.atemService.connect('192.168.0.218');
        // console.log(res);
    }

    @SubscribeMessage('macro:run')
    async handleMacroRun(client: Socket, payload: string) {
        console.log('was here');
        this.logger.log('running macro', payload);
        // this.logger.log(this.atemService.getDevice('192.168.0.218'))

        // await this.atemService.connect('192.168.0.218');

        const device = this.atemService.getDevice('192.168.0.218').atem;

        // await device.setUpstreamKeyerType({ flyEnabled: true, mixEffectKeyType: MixEffectKeyType.DVE }, 0, 0);

        // const something = new MixEffectKeyDVECommand(1,0);

        // await device.sendCommand(something);

        // const cmd = new Commands.MixEffectKeyDVECommand(0,0);
        // cmd.updateProps({  })

        // const cmd2 = new Commands.MixEffectKeyFlyPropertiesGetCommand(0,0, {
        //     isASet: true,
        //     isAtKeyFrame: IsAtKeyFrame.RunToInfinite,
        //     isBSet: false,
        //     runToInfiniteIndex: IsAtKeyFrame.A
        // })

        // cmd2.mixEffect.

        // const cmd3 = new Commands.MixEffectKeyDVECommand(0,0)
        // cmd3.properties.

        // const cmd4 = new Commands.MixEffectKeyDVECommand()

        // console.log(JSON.stringify(device.state));

        // await device.sendCommand(cmd2)

        // device.setUpstreamKeyerDVESettings()

        // await device.setUpstreamKeyerDVESettings({  })

        // device.state.video.mixEffects[0].upstreamKeyers[0].flyKeyframes[0].

        // device.setDVETransitionSettings({
        //     rate: 1.0,
        // });
        //
        // await device.setUpstreamKeyerDVESettings({
        //     positionX: 10.24,
        //     positionY: -5.78,
        //     // rate: 0.1,
        //     // rate: 1,
        //     sizeX: 0.36,
        //     sizeY: 0.36,
        //
        //     // maskEnabled: true,
        //
        // }, 0, 0)
        //     .catch(console.log);

        // await device.setDVETransitionSettings({
        //     keySource: 0,
        //
        // }, 0)

        // device.autoDownstreamKey(1, true);

        // console.log(JSON.stringify({ ...device.state }));

        // await device.setUpstreamKeyerOnAir(true, 0, 0);

        // device.setUpstreamKeyerDVESettings({
        //     positionX: 21.80,
        //     positionY: -12.26,
        //     rate: 1,
        //     sizeX: 0,
        //     sizeY: 0,
        // }, 0, 0);

        // device.setUpstreamKeyerDVESettings({
        //     positionX: 0,
        //     positionY: 0,
        //     rate: 1,
        //     sizeX: 1,
        //     sizeY: 1,
        // }, 0, 0);


        // this.atemService.getDevice('192.168.0.218').atem.
    }

    afterInit(server: Server) {
        this.logger.log('Init');
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }

    handleConnection(client: Socket, ...args: any[]) {
        this.logger.log(`Client connected: ${client.id}`);
    }
}