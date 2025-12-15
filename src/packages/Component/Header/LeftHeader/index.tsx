import { AssetsImagePath, Javascript } from '@/packages/Constant';
import { RootState, useAppDispatch } from '@/packages/Redux/ReduxStore';
import { ToggleSideBarIn } from '@/packages/Redux/Slices/HeaderSlice';
import Image from 'next/image';
import { AlignCenter } from 'react-feather';
import { useSelector } from 'react-redux';

const LeftHeader = () => {
  const { logoToggle } = useSelector((state: RootState) => state.headerSlice);
  
  const dispatch = useAppDispatch();
  const toggleSidebar = () => {
    dispatch(ToggleSideBarIn());
  };
  
  return (
    <div className='main-header-left'>
      <div className={`${logoToggle ? "dark-logo-wrapper" : "logo-wrapper"}`}>
        <a href={Javascript}> 
          <Image
            alt="logo Image"
            width={130}
            height={19}
            className="img-fluid"
            src="/assets/images/logo/logo_ar.png"
            unoptimized
          />

        </a>
      </div>
      <div className='toggle-sidebar' onClick={toggleSidebar}>
        <AlignCenter />
      </div>
    </div>
  );
};

export default LeftHeader;
