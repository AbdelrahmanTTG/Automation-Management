import { Fragment, useCallback, useState } from 'react';
import { Button, TabContent, TabPane } from 'reactstrap';
import { Configuration } from '../../Constant';
import ConfigurationClass from './ConfigurationClass';
import CheckLayout from './Tabs/CheckLayout';
import ColorPicker from './Tabs/ColorPicker/index';
import SidebarCustomizer from './Tabs/Sidebar';

const TabCustomizer = ({ selected, callbackNav }: any) => {
  const [modal, setModal] = useState<boolean>(false);
  const toggle = useCallback(() => {
    setModal(!modal);
  }, [modal]);

  return (
    <Fragment>
      <TabContent activeTab={selected}>
        <div className='customizer-header'>
          <i className='icofont-close icon-close' onClick={() => callbackNav(false)}></i>
          <h5>Live customizer</h5>
          <p className='mb-0'>Customize &amp; Preview Real Time</p>
          <Button color='primary' className='plus-popup mt-2' onClick={toggle}>
            {Configuration}
          </Button>
          <ConfigurationClass modal={modal} toggle={toggle} />
        </div>
        <div className='customizer-body custom-scrollbar tab-content'>
          <TabPane tabId='check-layout'>
            <CheckLayout />
          </TabPane>
          <TabPane tabId='sidebar-type'>
            <SidebarCustomizer />
          </TabPane>
          <TabPane tabId='color-picker'>
            <ColorPicker />
          </TabPane>
        </div>
      </TabContent>
    </Fragment>
  );
};

export default TabCustomizer;
