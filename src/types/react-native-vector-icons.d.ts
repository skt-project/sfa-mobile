declare module "react-native-vector-icons/Ionicons" {
  import { Component } from "react";
  import { TextStyle, ViewStyle } from "react-native";

  interface IconProps {
    name: string;
    size?: number;
    color?: string;
    style?: TextStyle | ViewStyle;
    accessible?: boolean;
    accessibilityLabel?: string;
    testID?: string;
  }

  export default class Icon extends Component<IconProps> {}
}

declare module "react-native-vector-icons/MaterialIcons" {
  import { Component } from "react";
  import { TextStyle, ViewStyle } from "react-native";

  interface IconProps {
    name: string;
    size?: number;
    color?: string;
    style?: TextStyle | ViewStyle;
    accessible?: boolean;
    accessibilityLabel?: string;
    testID?: string;
  }

  export default class Icon extends Component<IconProps> {}
}
