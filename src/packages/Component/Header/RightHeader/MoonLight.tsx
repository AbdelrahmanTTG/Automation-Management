import { useAppDispatch } from '@/packages/Redux/ReduxStore';
import { setLogoToggle } from '@/packages/Redux/Slices/HeaderSlice';
import React from 'react';
import { Moon } from 'react-feather';

const MoonLight = () => {
  const dispatch = useAppDispatch()
  const handleBodyElement = () => {
    dispatch(setLogoToggle())
    const bodyElement = document.body;
    bodyElement?.classList.contains('dark-sidebar') ? bodyElement?.classList.replace('dark-sidebar', 'light-only') : bodyElement?.classList.contains('light-only') ? bodyElement?.classList.replace('light-only', 'dark-only') : bodyElement?.classList.replace('dark-only', 'light-only');
  };
  return (
    <li>
      <div className='mode'>
        <Moon
          onClick={() => {
            handleBodyElement();
          }}
        />
      </div>
    </li>
  );
};

export default MoonLight;
