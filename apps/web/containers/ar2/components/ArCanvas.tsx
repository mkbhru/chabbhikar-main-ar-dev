"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Box, Button } from "@chakra-ui/react";

const ARCanvas = () => {
  const [isARSupported, setIsARSupported] = useState(false);
  const [isARToggled, setIsARToggled] = useState(false);
  const scene = useRef<THREE.Scene | null>(null);
  const renderer = useRef<THREE.WebGLRenderer | null>(null);
  const camera = useRef<THREE.PerspectiveCamera | null>(null);
  const hitTestSource = useRef<XRHitTestSource | null>(null);
  const xrSession = useRef<XRSession | null>(null);
  const reticle = useRef<THREE.Mesh | null>(null);
  const artwork = useRef<THREE.Mesh | null>(null);
  const xrReferenceSpace = useRef<XRReferenceSpace | null>(null);

  useEffect(() => {
    // Check WebXR support
    if (navigator.xr) {
      navigator.xr.isSessionSupported("immersive-ar").then(setIsARSupported);
    }
  }, []);

  const startAR = async () => {
    if (!navigator.xr) return;

    try {
      // Request an AR session
      const session = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["hit-test"],
      });

      xrSession.current = session;

      // Create Three.js scene
      scene.current = new THREE.Scene();
      camera.current = new THREE.PerspectiveCamera(
        70,
        window.innerWidth / window.innerHeight,
        0.01,
        20
      );

      renderer.current = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
      });

      renderer.current.xr.enabled = true;
      document.body.appendChild(renderer.current.domElement);

      const gl = renderer.current.getContext() as WebGLRenderingContext;
      const xrRefSpace = await session.requestReferenceSpace("local-floor");
      xrReferenceSpace.current = xrRefSpace;

      // Request hit test source
      const viewerSpace = await session.requestReferenceSpace("viewer");
      const hitTestSourceInit = await session.requestHitTestSource?.({
        space: viewerSpace,
      });

      if (!hitTestSourceInit) {
        console.error("Hit test source could not be created.");
        return;
      }

      hitTestSource.current = hitTestSourceInit;

      // Create reticle (indicator for placing artwork)
      const geometry = new THREE.RingGeometry(0.15, 0.2, 32);
      const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
      reticle.current = new THREE.Mesh(geometry, material);
      reticle.current.rotation.x = -Math.PI / 2;
      reticle.current.visible = false;
      scene.current.add(reticle.current);

      // Render loop
  const onXRFrame = (time: DOMHighResTimeStamp, frame: XRFrame | null) => {
    if (!frame || !scene.current || !renderer.current || !camera.current)
      return;

    const session = frame.session;
    const pose = frame.getViewerPose(xrReferenceSpace.current!);
    if (!pose) return;

    const hitTestResults = frame.getHitTestResults(hitTestSource.current!);

    // Ensure hitTestResults contains at least one valid entry
    if (hitTestResults.length > 0) {
      const hit = hitTestResults[0];

      // Ensure hit.getPose() does not return null
      const hitPose = hit?.getPose(xrReferenceSpace.current!);
      if (hitPose) {
        const matrix = new THREE.Matrix4().fromArray(hitPose.transform.matrix);
        reticle.current!.position.setFromMatrixPosition(matrix);
        reticle.current!.visible = true;
      }
    } else {
      // If no hit test results, hide reticle
      if (reticle.current) {
        reticle.current.visible = false;
      }
    }

    renderer.current!.render(scene.current!, camera.current!);
    session.requestAnimationFrame(onXRFrame);
  };
      session.requestAnimationFrame(onXRFrame);

      // Handle placement of artwork on user tap
      session.addEventListener("select", () => {
        if (!scene.current || !reticle.current) return;

        // Load artwork texture
        const texture = new THREE.TextureLoader().load("/art.png");

        // Create 3D plane for artwork
        const artworkGeometry = new THREE.PlaneGeometry(1, 1.5);
        const artworkMaterial = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
        });
        artwork.current = new THREE.Mesh(artworkGeometry, artworkMaterial);

        // Position artwork at the reticle location
        artwork.current.position.copy(reticle.current.position);
        artwork.current.lookAt(camera.current!.position);
        scene.current.add(artwork.current);
      });

      setIsARToggled(true);
    } catch (error) {
      console.error("Error starting AR session:", error);
    }
  };

  return (
    <Box width="100vw" height="100vh" bg="black" position="relative">
      {isARSupported ? (
        <Button
          position="absolute"
          bottom="20px"
          left="50%"
          transform="translateX(-50%)"
          colorScheme="teal"
          onClick={startAR}
        >
          Start AR
        </Button>
      ) : (
        <p style={{ color: "white", textAlign: "center" }}>
          AR not supported on this device
        </p>
      )}
    </Box>
  );
};

export default ARCanvas;
