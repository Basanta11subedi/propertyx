import React, { createContext, useContext, useState, useEffect } from "react";
import { connect, getLocalStorage, disconnect, isConnected, request } from "@stacks/connect";
import { Cl, fetchCallReadOnlyFunction, principalCV } from "@stacks/transactions";
import {createPrincipalCV,createUintCV,createStringCV,createBoolCV,createNoneCV,createSomeCV,cvToString,simulateContractCall,simulateContractWrite,parseAssetData} from "../utils/stacksHelper";

// IPFS gateway URL - used to fetch metadata from IPFS
const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

// Creating the wallet context
const WalletContext = createContext();

// Network configuration for testnet (can be changed to mainnet in production)
const network = {
  url: "https://stacks-node-api.testnet.stacks.co",
  chainId: 2147483648,
};

// WalletProvider component to wrap the app
export const WalletProvider = ({ children }) => {
  // State variables
  const [connected, setConnected] = useState(false);
  const [stxAddress, setStxAddress] = useState(null);
  const [userData, setUserData] = useState(null);
  const [balance, setBalance] = useState({ pxt: 0, btc: 0 });

  // Check if user is already logged in
  useEffect(() => {
    if (isConnected()) {
      const data = getLocalStorage();
      setUserData(data);
      setStxAddress(data.addresses.stx[0].address); // Use .mainnet for production
      setConnected(true);
      fetchBalance(data.addresses.stx[0].address);
    }
  }, []);

  // Fetch PXT and native token balance
  const fetchBalance = async (address) => {
    if (!address) return;

    try {
      if (isConnected()) {
        const options = {
          contract: "ST390VFVZJA4WP7QSZN0RTSGQDAG2P9NPN3X1ATDX.pxttest1",
          functionName: "get-balance",
          functionArgs: [Cl.principal(address)],
          network: "testnet",
          senderAddress: stxAddress,
        };

        const result = await fetchCallReadOnlyFunction(options);
        console.log("get-balance responce: ", parseInt(result.value.value));
        setBalance({ pxt: parseInt(result.value.value), btc: 0 });
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
      setBalance({ pxt: 0, btc: 0 });
    }
  };


  // Connect to wallet
  const getConnect = async () => {
    if (isConnected()) return;
    await connect();
    const data = getLocalStorage();
    setUserData(data);
    setStxAddress(data.addresses.stx[0].address); // Use .mainnet for production
    setConnected(true);
    fetchBalance(data.addresses.stx[0].address);
  };

  // Disconnect from wallet
  const getDisconnect = () => {
    setConnected(false);
    setStxAddress(null);
    setUserData(null);
    setBalance({ pxt: 0, btc: 0 });
    disconnect();
  };

 

  // Function to check if the current user is the admin
  const checkIsAdmin = async () => {
    if (!connected) return false;

    try {
      if (connected) {
        const response =  {
          contract: "ST390VFVZJA4WP7QSZN0RTSGQDAG2P9NPN3X1ATDX.pxttest1",
          mapName: "admins",
          mapKey: principalCV(stxAddress),
          network: "testnet",
          senderAddress: stxAddress
          };
          const owner = await fetchContractMapEntry(response);

        console.log("admin", response);

        if (response.value && response.value.type === "ok") {
          const adminAddress = response.value.value.address;
          return adminAddress === stxAddress;
        }

        return false;
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
      return false;
    }
  };

//   // Function to fetch metadata from IPFS
//   const fetchIpfsMetadata = async (cid) => {
//     if (!cid) return null;

//     try {
//       const url = `${IPFS_GATEWAY}${cid}`;
//       const response = await fetch(url);

//       if (!response.ok) {
//         throw new Error(`Failed to fetch IPFS data: ${response.status}`);
//       }

//       return await response.json();
//     } catch (error) {
//       console.error("Error fetching IPFS metadata:", error);
//       return null;
//     }
//   };

  // Function to get all marketplace listings
//   const getMarketplaceListings = async () => {
//     if (!connected) return [];

//     try {
//       // For a real implementation, we would query the contract for all listings
//       // Here we'll simulate a few listings
//       const listings = [];

//       for (let i = 1; i <= 5; i++) {
//         const result = await simulateContractCall({
//           contractAddress: "ST1VZ3YGJKKC8JSSWMS4EZDXXJM7QWRBEZ0ZWM64E",
//           contractName: "nft-marketplace",
//           functionName: "get-listing",
//           functionArgs: [createUintCV(i)],
//           network,
//           senderAddress: stxAddress,
//         });

//         if (result.value && result.value.type === "tuple") {
//           const listingData = result.value.data;

//           // Get NFT details
//           const nftData = await getNftData(listingData.tokenId.value);

//           if (nftData && nftData.owner) {
//             const assetData = await getAssetData(
//               nftData.owner,
//               listingData.tokenId.value,
//             );

//             if (assetData) {
//               // Generate an IPFS CID for the metadata
//               const ipfsCid = `QmNR2n4zywCV61MeMLB6JwPueAPqhbtqMfCMKDRQftUSa${i}`;

//               // Create the listing object
//               listings.push({
//                 id: listingData.id.value,
//                 tokenId: listingData.tokenId.value,
//                 name: assetData.name,
//                 description: assetData.description,
//                 assetType: "property",
//                 owner: listingData.maker.address,
//                 price: listingData.price.value,
//                 currency: "STX",
//                 imageUrl: `https://ipfs.io/ipfs/QmbeQYcm8xTdTtXiYPwTR8oBGPEZ9cZMLs4YgWkfQMCUJ${i}/image.jpg`,
//                 metadataCid: ipfsCid,
//                 createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
//                 expiry: listingData.expiry.value,
//                 isCancelled: listingData.isCancelled.value,
//               });
//             }
//           }
//         }
//       }

//       return listings;
//     } catch (error) {
//       console.error("Error fetching marketplace listings:", error);
//       return [];
//     }
//   };


  // The context value that will be supplied to any descendants of this provider
  const contextValue = {
    connected,
    stxAddress,
    userData,
    balance,
    getConnect,
    getDisconnect,
    callContract,
    fetchBalance,
    checkIsAdmin,
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
};

// Custom hook to use the wallet context
export const useWallet = () => useContext(WalletContext);

export default WalletContext;
