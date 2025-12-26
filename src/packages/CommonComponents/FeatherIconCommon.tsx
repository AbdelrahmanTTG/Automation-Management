// import { fetherType } from '@/Type/SideBarType';
import * as Icon from 'react-feather';

const FeatherIconCommon = ({ iconName, className }: fetherType) => {
  const IconComp = Icon[iconName];
  return <IconComp className={className} />;
};

export default FeatherIconCommon;
