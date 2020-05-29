import React, { Fragment } from 'react';

import FilterSelector from '../../FilterSelector/FilterSelector';

const NewPostFilter = ({ previewImage, setPreviewImage, filters }) => {
  return (
    <Fragment>
      <div className="new-post__preview">
        <div className="new-post__preview-image-container">
          <img
            src={previewImage.src}
            alt="Photo to customize"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: previewImage.filter,
            }}
          />
        </div>
      </div>
      <FilterSelector
        setFilter={(filter, filterName) =>
          setPreviewImage((previous) => ({ ...previous, filter, filterName }))
        }
        previewImage={previewImage.src}
        filters={filters}
      />
    </Fragment>
  );
};

export default NewPostFilter;
