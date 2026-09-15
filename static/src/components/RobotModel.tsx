import React, { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useAnimations, Environment, Float } from '@react-three/drei';
import * as THREE from 'three';

interface RobotModelProps {
  isThinking: boolean;
}

// Simple Error Boundary to catch 404s when the model is missing
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.warn("Failed to load 3D model:", error);
  }
  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

// Sub-component to load and animate the model
function Robot({ isThinking }: { isThinking: boolean }) {
  const group = useRef<THREE.Group>(null);
  
  // Use suspense to load the model. Replace '/robot.glb' with the actual filename.
  const { scene, animations } = useGLTF('/robot.glb');
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    // Play the first animation if it exists
    const actionNames = Object.keys(actions);
    if (actionNames.length > 0 && actions[actionNames[0]]) {
      const action = actions[actionNames[0]];
      
      if (isThinking) {
        action.play();
        action.paused = false;
      } else {
        // Pause animation when not thinking
        action.paused = true;
      }
    }
  }, [actions, isThinking]);

  return (
    <group ref={group} dispose={null}>
      <Float
        speed={isThinking ? 2 : 0.5} // Faster floating when thinking
        rotationIntensity={isThinking ? 0.5 : 0.1} 
        floatIntensity={isThinking ? 1 : 0.2}
      >
        {/* We scale and position to fit nicely in the background */}
        <primitive object={scene} scale={2} position={[0, -1.5, 0]} />
      </Float>
    </group>
  );
}

export const RobotModel: React.FC<RobotModelProps> = ({ isThinking }) => {
  return (
    <div 
      className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ease-in-out z-0`}
      style={{ opacity: isThinking ? 0.8 : 0.05 }}
    >
      <ErrorBoundary>
        <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          {/* Environment map for nice reflections if the model has metallic/rough materials */}
          <Environment preset="city" />
          
          {/* We use React.Suspense to prevent crashing while loading the model */}
          <React.Suspense fallback={null}>
            <Robot isThinking={isThinking} />
          </React.Suspense>
        </Canvas>
      </ErrorBoundary>
    </div>
  );
};

// Intentionally disabled preload so it doesn't throw outside the error boundary if missing
// useGLTF.preload('/robot.glb');
