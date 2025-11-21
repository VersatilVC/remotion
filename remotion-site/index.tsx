import React from 'react';
import { Composition, registerRoot } from 'remotion';

// Placeholder component - actual component code will be passed via inputProps
const DynamicVideo: React.FC<{ code?: string }> = ({ code }) => {
  return (
    <div
      style={{
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: 60,
        color: 'white',
      }}
    >
      Dynamic Video Placeholder
    </div>
  );
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Main"
        component={DynamicVideo}
        durationInFrames={120}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          code: '',
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
