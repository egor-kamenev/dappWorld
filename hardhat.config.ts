import { HardhatUserConfig } from "hardhat/config";
import "tsconfig-paths/register"; // This adds support for typescript paths mappings
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-solhint";

const config: HardhatUserConfig = {
    networks: {
        hardhat: {
            allowBlocksWithSameTimestamp: true,
        },
    },
    solidity: "0.8.21",
};

export default config;
