import React, { useState } from 'react';
import { Slider } from '@material-ui/core';
import { SocketProvider, useSocket } from "core/SocketContext";

const ratio = 16/9;

const TOTAL = 4433;
const ZOOMMax = 16384;

const getNumber = (val: any) => {
    if (Array.isArray(val)) {
        return val[0];
    }
    return val;
}

function CameraControl({ pan, setPan, tilt, setTilt, zoom, setZoom }: any) {
    

    const socket = useSocket();

    const handlePanChange = (event: any, newValue: number | number[]) => {
        setPan(getNumber(newValue));
    }

    const handleTiltChange = (event: any, newValue: number | number[]) => {
        setTilt(getNumber(newValue));
    }

    const handleZoomChange = (event: any, newValue: number | number[]) => {
        setZoom(getNumber(newValue));
    }

    return (
        <div style={{ width: '700px', paddingBottom: 20 }}>
            <div style={{ width: '100%', display: 'flex' }}>

                <div className="play-container" style={{ flexGrow: 1 }}>
                    <div
                        className="play"
                        style={{
                            paddingBottom: '56.25%',
                            border: '1px solid rgba(0,0,0,0.8)',
                            position: 'relative',
                            background: "url('/blank_stage.png') 100% 100%",
                            backgroundSize: 'cover',
                            overflow: 'hidden'
                        }}
                    >
                        
                        <div
                            className="pov"
                            style={{
                                border: '1px solid red',
                                position: 'absolute',
                                left: '50%',
                                top: '50%',


                                marginLeft: `${((100/2216) * pan)}%`,
                                marginTop: `${((100/1116) * (tilt * -1 ) )}%`,

                                transform: `translateX(-50%) translateY(-50%)`,
                                width: `${100 - ((100/18018) * zoom)}%`,
                                height: `${100 - ((100/18018) * zoom)}%`,
                                boxShadow: 'inset 0 0 0 2px red',
                            }}
                        />

                    </div>
                    
                </div>
                <div className="controls-vertical-tilt" style={{ width: 30 }}>

                    <Slider
                        orientation="vertical"

                        min={-1116}
                        max={372}
                        defaultValue={0}
                        
                        track={false}
                        value={tilt}
                        onChange={handleTiltChange}

                        marks={[
                            { value: 372, label: 'Up' },
                            { value: 0, label: '0'},
                            { value: -1116, label: 'Down' }
                        ]}
                    />
                </div>
            </div>

            <div className="controls-horizontal-pan" style={{ paddingRight: 30 }}>
                <Slider
                    value={pan}
                    min={-2216}
                    max={2216}
                    track={false}
                    onChange={handlePanChange}
                    marks={[
                        { value: 2216, label: 'R' },
                        { value: 0, label: '0'},
                        { value: -2216, label: 'L' }
                    ]}
                />
            </div>   
            <div className="controls-horizontal-zoom" style={{ paddingRight: 30, marginTop: 20 }}>
                <Slider
                    value={zoom}
                    min={0}
                    max={16384}
                    track={false}
                    onChange={handleZoomChange}
                    marks={[
                        { value: 0, label: '0x' },
                        { value: 1638, label: '1x' },
                        { value: 3327, label: '2x' },
                        { value: 4915, label: '3x' },
                        { value: 6554, label: '4x' },
                        { value: 8192, label: '5x' },
                        { value: 9830, label: '6x' },
                        { value: 11469, label: '7x' },
                        { value: 13107, label: '8x' },
                        { value: 14746, label: '9x' },
                        { value: 16384, label: '10x' },
                    ]}
                    // step={16384/10}
                />
            </div>            
        </div>
    );
}

export default CameraControl;
