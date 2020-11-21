import React from "react";
import { useAtemState } from 'core/SocketContext';

function Surface() {
  const atemState = useAtemState();
  console.log(atemState);

  return (
    <div>

      <code style={{ paddingTop: '100px' }}>
        { JSON.stringify(atemState) }
      </code>
      this is the surface
    </div>
  );
}

export default Surface;
